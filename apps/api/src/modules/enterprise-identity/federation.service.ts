import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  AuthMethod,
  IdentityProvider,
  Prisma,
} from '@prisma/client';
import {
  SAML,
  ValidateInResponseTo,
  type CacheProvider,
} from '@node-saml/node-saml';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { RedisService } from '../../core/cache/redis.service';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { decryptSensitiveField } from '../../core/security/crypto.util';
import { AuthService } from '../auth/auth.service';

type OidcModule = typeof import('openid-client');
// TypeScript emits CommonJS for this Nest application, while openid-client v6
// is ESM-only. The module specifier is constant and cannot receive user input.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importEsm = new Function(
  "return import('openid-client')",
) as () => Promise<OidcModule>;

interface FederationState {
  providerId: string;
  state: string;
  nonce?: string;
  codeVerifier?: string;
  returnUrl?: string;
}

export function providerVerifiedMfa(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.includes('mfa') || (amr.includes('pwd') && amr.includes('otp'));
}

interface PendingFederation {
  userId: string;
  method: 'OIDC' | 'SAML';
  ipAddress: string;
  userAgent: string;
  providerMfa: boolean;
}

@Injectable()
export class FederationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async listPublicProviders(schoolCode: string) {
    return this.prisma.identityProvider.findMany({
      where: {
        enabled: true,
        school: { code: schoolCode.trim().toUpperCase(), isActive: true },
      },
      orderBy: { name: 'asc' },
      select: { name: true, slug: true, type: true },
    });
  }

  async start(schoolCode: string, providerSlug: string, returnUrl?: string) {
    this.assertStateStore();
    const provider = await this.prisma.identityProvider.findFirst({
      where: {
        slug: providerSlug,
        enabled: true,
        school: { code: schoolCode, isActive: true },
      },
    });
    if (!provider) throw new NotFoundException('Identity provider not found');
    const state = randomBytes(32).toString('base64url');
    const safeReturnUrl = this.safeReturnUrl(returnUrl);

    if (provider.type === 'OIDC') {
      const oidc = await importEsm();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const nonce = oidc.randomNonce();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      await this.saveState({
        providerId: provider.id,
        state,
        nonce,
        codeVerifier,
        returnUrl: safeReturnUrl,
      });
      const client = await this.oidcConfiguration(provider, oidc);
      return oidc.buildAuthorizationUrl(client, {
        redirect_uri: this.oidcCallbackUrl(),
        scope: 'openid email profile',
        response_type: 'code',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).href;
    }

    await this.saveState({
      providerId: provider.id,
      state,
      returnUrl: safeReturnUrl,
    });
    const saml = this.samlClient(provider);
    return saml.getAuthorizeUrlAsync(state, undefined, {});
  }

  async completeOidc(
    callbackUrl: URL,
    state: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const stored = await this.consumeState(state);
    const provider = await this.requireProvider(stored.providerId, 'OIDC');
    const oidc = await importEsm();
    const client = await this.oidcConfiguration(provider, oidc);
    const tokens = await oidc.authorizationCodeGrant(client, callbackUrl, {
      expectedState: stored.state,
      expectedNonce: stored.nonce,
      pkceCodeVerifier: stored.codeVerifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims?.sub)
      throw new UnauthorizedException('OIDC subject claim is missing');
    const user = await this.resolveUser(provider, claims.sub, claims.email, {
      givenName:
        typeof claims.given_name === 'string' ? claims.given_name : undefined,
      familyName:
        typeof claims.family_name === 'string' ? claims.family_name : undefined,
      displayName: typeof claims.name === 'string' ? claims.name : undefined,
      claims: { sub: claims.sub, email: claims.email, iss: claims.iss },
    });
    return this.createExchange(
      user.id,
      AuthMethod.OIDC,
      ipAddress,
      userAgent,
      stored.returnUrl,
      providerVerifiedMfa(claims.amr),
    );
  }

  async completeSaml(
    providerId: string,
    samlResponse: string,
    relayState: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const stored = await this.consumeState(relayState);
    if (stored.providerId !== providerId)
      throw new UnauthorizedException('SAML state mismatch');
    const provider = await this.requireProvider(providerId, 'SAML');
    const result = await this.samlClient(provider).validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });
    const profile = result.profile;
    if (!profile?.nameID)
      throw new UnauthorizedException('SAML subject is missing');
    const email =
      profile.email ||
      profile.mail ||
      profile['urn:oid:0.9.2342.19200300.100.1.3'];
    const user = await this.resolveUser(
      provider,
      profile.nameID,
      typeof email === 'string' ? email : undefined,
      {
        claims: {
          issuer: profile.issuer,
          nameID: profile.nameID,
          sessionIndex: profile.sessionIndex,
        },
      },
    );
    return this.createExchange(
      user.id,
      AuthMethod.SAML,
      ipAddress,
      userAgent,
      stored.returnUrl,
    );
  }

  async exchange(code: string, otp?: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
      throw new UnauthorizedException(
        'SSO exchange code is invalid or expired',
      );
    }
    const key = `federation:exchange:${code}`;
    const serialized = await this.redis.get(key);
    if (!serialized)
      throw new UnauthorizedException(
        'SSO exchange code is invalid or expired',
      );
    const pending = JSON.parse(serialized) as PendingFederation;
    const verified = await this.auth.verifyFederatedMfa(
      pending.userId,
      pending.providerMfa,
      otp,
    );
    // Retain the challenge while MFA is required, then consume atomically so
    // simultaneous exchanges cannot issue more than one session.
    if ((await this.redis.getAndDelete(key)) !== serialized) {
      throw new UnauthorizedException('SSO exchange code was already consumed');
    }
    return this.auth.issueFederatedSession(
      pending.userId,
      pending.method,
      pending.ipAddress,
      pending.userAgent,
      verified,
    );
  }

  async samlMetadata(schoolCode: string, providerSlug: string) {
    const provider = await this.prisma.identityProvider.findFirst({
      where: { slug: providerSlug, type: 'SAML', school: { code: schoolCode } },
    });
    if (!provider) throw new NotFoundException('SAML provider not found');
    return this.samlClient(provider).generateServiceProviderMetadata(null);
  }

  private async createExchange(
    userId: string,
    method: 'OIDC' | 'SAML',
    ipAddress: string,
    userAgent: string,
    returnUrl?: string,
    providerMfa = false,
  ) {
    const code = randomBytes(32).toString('base64url');
    await this.redis.set(
      `federation:exchange:${code}`,
      JSON.stringify({
        userId,
        method,
        ipAddress,
        userAgent,
        providerMfa,
      } satisfies PendingFederation),
      300,
    );
    return {
      code,
      returnUrl:
        returnUrl ||
        `${this.config.get<string>('app.appUrl')}/auth/sso/callback`,
    };
  }

  private async resolveUser(
    provider: IdentityProvider,
    subject: string,
    email: unknown,
    profile: {
      givenName?: string;
      familyName?: string;
      displayName?: string;
      claims: Record<string, unknown>;
    },
  ) {
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail)
      throw new UnauthorizedException('Federated email claim is required');
    const domain = normalizedEmail.split('@')[1];
    if (
      provider.allowedDomains.length &&
      !provider.allowedDomains.includes(domain)
    ) {
      throw new ForbiddenException(
        'Email domain is not allowed for this identity provider',
      );
    }
    const existingIdentity = await this.prisma.externalIdentity.findUnique({
      where: { providerId_subject: { providerId: provider.id, subject } },
      include: { user: true },
    });
    if (existingIdentity) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.externalIdentity.update({
          where: { id: existingIdentity.id },
          data: {
            email: normalizedEmail,
            claims: profile.claims as Prisma.InputJsonValue,
            lastLoginAt: new Date(),
          },
        });
        await this.audit.recordMutation(
          {
            schoolId: provider.schoolId,
            userId: existingIdentity.userId,
            action: AuditAction.UPDATE,
            module: 'FEDERATION',
            resourceId: existingIdentity.id,
            resourceType: 'ExternalIdentity',
            description: `${provider.type} external identity used`,
            before: {
              email: existingIdentity.email,
              lastLoginAt: existingIdentity.lastLoginAt,
            },
            after: { email: updated.email, lastLoginAt: updated.lastLoginAt },
          },
          tx,
        );
      });
      return existingIdentity.user;
    }
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (user && user.schoolId !== provider.schoolId) {
      throw new ForbiddenException('Account belongs to a different tenant');
    }
    if (!user && !provider.jitProvisioning)
      throw new ForbiddenException('Account is not provisioned');
    const existingUser = user;
    const passwordHash = existingUser
      ? undefined
      : await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
    const displayParts = profile.displayName?.trim().split(/\s+/) ?? [];
    return this.prisma.$transaction(async (tx) => {
      const linkedUser =
        existingUser ??
        (await tx.user.create({
          data: {
            schoolId: provider.schoolId,
            email: normalizedEmail,
            passwordHash: passwordHash!,
            role: provider.defaultRole,
            status: 'ACTIVE',
            emailVerified: true,
            firstName: profile.givenName || displayParts[0] || 'Federated',
            lastName:
              profile.familyName || displayParts.slice(1).join(' ') || 'User',
          },
        }));
      const identity = await tx.externalIdentity.create({
        data: {
          providerId: provider.id,
          userId: linkedUser.id,
          subject,
          email: normalizedEmail,
          claims: profile.claims as Prisma.InputJsonValue,
          lastLoginAt: new Date(),
        },
      });
      await this.audit.recordMutation(
        {
          schoolId: provider.schoolId,
          userId: linkedUser.id,
          action: AuditAction.CREATE,
          module: 'FEDERATION',
          resourceId: identity.id,
          resourceType: 'ExternalIdentity',
          description: existingUser
            ? `${provider.type} identity linked to account`
            : `${provider.type} account provisioned just in time`,
          before: null,
          after: {
            providerId: provider.id,
            userId: linkedUser.id,
            subject,
            email: normalizedEmail,
            jitProvisioned: !existingUser,
          },
        },
        tx,
      );
      return linkedUser;
    });
  }

  private async oidcConfiguration(
    provider: IdentityProvider,
    oidc: OidcModule,
  ) {
    if (!provider.issuer || !provider.clientId)
      throw new ServiceUnavailableException('OIDC provider is incomplete');
    return oidc.discovery(
      new URL(provider.issuer),
      provider.clientId,
      decryptSensitiveField(provider.clientSecretEncrypted) || undefined,
    );
  }

  private samlClient(provider: IdentityProvider) {
    if (
      !provider.samlEntityId ||
      !provider.samlSsoUrl ||
      !provider.samlCertificate
    ) {
      throw new ServiceUnavailableException('SAML provider is incomplete');
    }
    const cacheProvider: CacheProvider = {
      saveAsync: async (key, value) => {
        await this.redis.set(`saml:request:${key}`, value, 600);
        return { value, createdAt: Date.now() };
      },
      getAsync: (key) => this.redis.get(`saml:request:${key}`),
      removeAsync: (key) =>
        key
          ? this.redis.getAndDelete(`saml:request:${key}`)
          : Promise.resolve(null),
    };
    return new SAML({
      issuer: provider.samlEntityId,
      callbackUrl: this.samlCallbackUrl(provider.id),
      entryPoint: provider.samlSsoUrl,
      idpCert: provider.samlCertificate,
      audience: provider.samlEntityId,
      validateInResponseTo: ValidateInResponseTo.always,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      signatureAlgorithm: 'sha256',
      acceptedClockSkewMs: 60_000,
      maxAssertionAgeMs: 300_000,
      requestIdExpirationPeriodMs: 600_000,
      cacheProvider,
    });
  }

  private async requireProvider(id: string, type: 'OIDC' | 'SAML') {
    const provider = await this.prisma.identityProvider.findFirst({
      where: { id, type, enabled: true },
    });
    if (!provider)
      throw new UnauthorizedException(
        'Identity provider is disabled or missing',
      );
    return provider;
  }

  private async saveState(state: FederationState) {
    await this.redis.set(
      `federation:state:${state.state}`,
      JSON.stringify(state),
      600,
    );
  }

  private async consumeState(state: string) {
    const value = await this.redis.getAndDelete(`federation:state:${state}`);
    if (!value)
      throw new UnauthorizedException('Federation state is invalid or expired');
    return JSON.parse(value) as FederationState;
  }

  private assertStateStore() {
    if (
      this.config.get<string>('app.nodeEnv') === 'production' &&
      this.redis.getStatus().mode !== 'REDIS'
    ) {
      throw new ServiceUnavailableException(
        'Enterprise SSO requires Redis in production',
      );
    }
  }

  private safeReturnUrl(value?: string) {
    if (!value) return undefined;
    const appUrl = new URL(this.config.getOrThrow<string>('app.appUrl'));
    const candidate = new URL(value, appUrl);
    return candidate.origin === appUrl.origin ? candidate.href : undefined;
  }

  private oidcCallbackUrl() {
    return `${this.config.getOrThrow<string>('app.apiUrl')}/api/v1/sso/oidc/callback`;
  }

  private samlCallbackUrl(providerId: string) {
    return `${this.config.getOrThrow<string>('app.apiUrl')}/api/v1/sso/saml/${providerId}/callback`;
  }
}
