import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { encryptSensitiveField } from '../../core/security/crypto.util';
import {
  IdentityProviderSchema,
  IdentityProviderPatchSchema,
} from './identity.schemas';

@Injectable()
export class IdentityProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(schoolId: string) {
    const providers = await this.prisma.identityProvider.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
    return providers.map((provider) => this.redact(provider));
  }

  async create(schoolId: string, actorId: string, input: unknown) {
    const dto = IdentityProviderSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.identityProvider.create({
        data: {
          schoolId,
          name: dto.name,
          slug: dto.slug,
          type: dto.type,
          enabled: dto.enabled,
          issuer: dto.issuer,
          clientId: dto.clientId,
          clientSecretEncrypted: encryptSensitiveField(dto.clientSecret),
          samlEntityId: dto.samlEntityId,
          samlSsoUrl: dto.samlSsoUrl,
          samlCertificate: dto.samlCertificate,
          allowedDomains: dto.allowedDomains,
          defaultRole: dto.defaultRole,
          jitProvisioning: dto.jitProvisioning,
          enforceSso: dto.enforceSso,
        },
      });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: actorId,
          action: AuditAction.CREATE,
          module: 'IDENTITY_PROVIDER',
          resourceId: provider.id,
          resourceType: 'IdentityProvider',
          description: `${provider.type} identity provider created`,
          before: null,
          after: this.redact(provider),
        },
        tx,
      );
      return this.redact(provider);
    });
  }

  async update(
    schoolId: string,
    providerId: string,
    actorId: string,
    input: unknown,
  ) {
    const patch = IdentityProviderPatchSchema.parse(input);
    const before = await this.prisma.identityProvider.findFirst({
      where: { id: providerId, schoolId },
    });
    if (!before) throw new NotFoundException('Identity provider not found');
    const dto = IdentityProviderSchema.parse({ ...before, ...patch });
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.identityProvider.update({
        where: { id: providerId },
        data: {
          ...dto,
          clientSecretEncrypted:
            dto.clientSecret === undefined
              ? undefined
              : encryptSensitiveField(dto.clientSecret),
          clientSecret: undefined,
          config: undefined,
        } as Prisma.IdentityProviderUpdateInput,
      });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: actorId,
          action: AuditAction.UPDATE,
          module: 'IDENTITY_PROVIDER',
          resourceId: providerId,
          resourceType: 'IdentityProvider',
          description: `${after.type} identity provider updated`,
          before: this.redact(before),
          after: this.redact(after),
        },
        tx,
      );
      return this.redact(after);
    });
  }

  private redact<T extends { clientSecretEncrypted: string | null }>(
    provider: T,
  ) {
    const { clientSecretEncrypted, ...safe } = provider;
    return {
      ...safe,
      hasClientSecret: Boolean(clientSecretEncrypted),
    };
  }
}
