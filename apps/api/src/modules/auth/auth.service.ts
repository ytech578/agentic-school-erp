import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { AuditAction, AuthMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../../core/security/crypto.util';
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
} from '../../core/security/totp.util';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../services/email/email.service';
import { ROLE_PERMISSIONS, UserRole } from '@school-erp/shared';
import type { LoginInput, ResetPasswordInput } from '@school-erp/shared';
import { hashRefreshToken } from './utils/refresh-token.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private audit: AuditService,
  ) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginInput, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { school: { select: { id: true, name: true, code: true } } },
    });

    // Account lockout check
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        message: 'Account temporarily locked due to too many failed attempts',
        unlockAt: user.lockedUntil,
      });
    }

    // Validate credentials (same error message to prevent enumeration)
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      if (user) {
        await this.incrementFailedAttempts(user.id);
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Account status check
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Your account has been deactivated. Contact your administrator.',
      );
    }

    if (user.schoolId && user.role !== 'SUPER_ADMIN') {
      const enforced = await this.prisma.identityProvider.findFirst({
        where: { schoolId: user.schoolId, enabled: true, enforceSso: true },
        select: { id: true },
      });
      if (enforced) {
        throw new ForbiddenException(
          'Password login is disabled for this school. Use enterprise SSO.',
        );
      }
    }

    const mfaVerified = user.twoFactorEnabled
      ? await this.verifyMfaChallenge(user, dto.otp)
      : false;

    const sessionId = crypto.randomUUID();

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId,
      sessionId,
      AuthMethod.PASSWORD,
      mfaVerified,
    );

    await this.prisma.$transaction(async (tx) => {
      const before = {
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
      };
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
          ...(mfaVerified ? { mfaLastVerifiedAt: new Date() } : {}),
        },
        select: {
          failedLoginAttempts: true,
          lockedUntil: true,
          lastLoginAt: true,
          lastLoginIp: true,
        },
      });
      await this.createSession(
        user.id,
        tokens.refreshToken,
        ipAddress,
        userAgent,
        AuthMethod.PASSWORD,
        mfaVerified,
        sessionId,
        tx,
      );
      await this.audit.recordMutation(
        {
          userId: user.id,
          schoolId: user.schoolId,
          action: AuditAction.LOGIN,
          module: 'AUTH',
          resourceId: sessionId,
          resourceType: 'UserSession',
          description: 'Password login session created',
          before,
          after: updated,
          ipAddress,
        },
        tx,
      );
    });

    this.logger.log(`User ${user.email} logged in from ${ipAddress}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        schoolId: user.schoolId,
        avatarUrl: user.avatarUrl,
        permissions: ROLE_PERMISSIONS[user.role] ?? [],
        school: user.school,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId,
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: { refreshToken: tokenHash, userId },
      include: { user: { select: { schoolId: true } } },
    });
    if (!session) return;
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.userSession.update({
        where: { id: session.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: userId,
          revokeReason: 'User logout',
        },
      });
      await this.audit.recordMutation(
        {
          userId,
          schoolId: session.user.schoolId,
          action: AuditAction.LOGOUT,
          module: 'AUTH',
          resourceId: session.id,
          resourceType: 'UserSession',
          description: 'User session logged out and revoked',
          before: session,
          after,
        },
        tx,
      );
    });
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string, ipAddress: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            schoolId: true,
            status: true,
          },
        },
      },
    });

    if (
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const { user } = session;
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is inactive');
    }

    // Rotate refresh token
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId,
      session.id || crypto.randomUUID(),
      session.authMethod || AuthMethod.PASSWORD,
      Boolean(session.mfaVerifiedAt),
    );

    const newTokenHash = hashRefreshToken(tokens.refreshToken);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: newTokenHash,
        expiresAt: new Date(
          Date.now() +
            this.config.get<number>(
              'jwt.refreshExpiresInMs',
              7 * 24 * 60 * 60 * 1000,
            ),
        ),
        ipAddress,
        lastSeenAt: new Date(),
      },
    });

    return tokens;
  }

  // ─── Get Current User ────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: { select: { id: true, name: true, code: true } } },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      schoolId: user.schoolId,
      avatarUrl: user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      mfaEnrolledAt: user.mfaEnrolledAt,
      permissions: ROLE_PERMISSIONS[user.role] ?? [],
      school: user.school,
    };
  }

  async beginMfaEnrollment(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'MFA is already enabled; disable it before re-enrolling',
      );
    }

    const secret = generateTotpSecret();
    const issuer = this.config.get<string>('MFA_ISSUER', 'Agentic School ERP');
    const uri = generateTotpUri({ issuer, label: user.email, secret });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptSensitiveField(secret),
        twoFactorEnabled: false,
        mfaRecoveryCodes: Prisma.DbNull,
        mfaEnrolledAt: null,
      },
    });
    return {
      secret,
      otpauthUri: uri,
      qrCodeDataUrl: await QRCode.toDataURL(uri),
    };
  }

  async confirmMfaEnrollment(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = decryptSensitiveField(user?.twoFactorSecret);
    if (!user || !secret || !verifyTotp(secret, token)) {
      throw new UnauthorizedException('Invalid authenticator code');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('MFA enrollment is already confirmed');
    }
    const recoveryCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(6).toString('hex').toUpperCase(),
    );
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, twoFactorEnabled: false },
        data: {
          twoFactorEnabled: true,
          mfaEnrolledAt: new Date(),
          mfaLastVerifiedAt: new Date(),
          mfaRecoveryCodes: recoveryCodes.map((code) =>
            this.hashRecoveryCode(code),
          ),
        },
      });
      if (changed.count !== 1) {
        throw new BadRequestException('MFA enrollment is already confirmed');
      }
      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          schoolId: true,
          twoFactorEnabled: true,
          mfaEnrolledAt: true,
        },
      });
      await this.audit.recordMutation(
        {
          userId,
          schoolId: updated.schoolId,
          action: AuditAction.UPDATE,
          module: 'AUTH',
          resourceId: userId,
          resourceType: 'User',
          description: 'MFA enrollment completed',
          before: { twoFactorEnabled: false },
          after: {
            twoFactorEnabled: true,
            mfaEnrolledAt: updated.mfaEnrolledAt,
          },
        },
        tx,
      );
    });
    return { recoveryCodes };
  }

  async disableMfa(userId: string, password: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash)) ||
      !(await this.verifyMfaChallenge(user, token))
    ) {
      throw new UnauthorizedException('Password or MFA code is invalid');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          mfaRecoveryCodes: Prisma.DbNull,
          mfaEnrolledAt: null,
          mfaLastVerifiedAt: null,
        },
      });
      await tx.userSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: userId,
          revokeReason: 'MFA disabled',
        },
      });
      await this.audit.recordMutation(
        {
          userId,
          schoolId: user.schoolId,
          action: AuditAction.UPDATE,
          module: 'AUTH',
          resourceId: userId,
          resourceType: 'User',
          description: 'MFA disabled and active sessions revoked',
          before: { twoFactorEnabled: true },
          after: { twoFactorEnabled: false },
        },
        tx,
      );
    });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        userAgent: true,
        status: true,
        authMethod: true,
        mfaVerifiedAt: true,
        lastSeenAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        revokeReason: true,
      },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrentSession: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const before = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      include: { user: { select: { schoolId: true } } },
    });
    if (!before) throw new BadRequestException('Active session not found');
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.userSession.update({
        where: { id: sessionId },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: userId,
          revokeReason: 'Revoked by user',
        },
      });
      await this.audit.recordMutation(
        {
          userId,
          schoolId: before.user.schoolId,
          action: AuditAction.UPDATE,
          module: 'AUTH',
          resourceId: sessionId,
          resourceType: 'UserSession',
          description: 'User session revoked',
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const [before, user] = await Promise.all([
      this.prisma.userSession.findMany({
        where: { userId, id: { not: currentSessionId }, status: 'ACTIVE' },
        select: { id: true, status: true, lastSeenAt: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { schoolId: true },
      }),
    ]);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.userSession.updateMany({
        where: { userId, id: { not: currentSessionId }, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: userId,
          revokeReason: 'Other sessions revoked by user',
        },
      });
      await this.audit.recordMutation(
        {
          userId,
          schoolId: user?.schoolId ?? null,
          action: AuditAction.UPDATE,
          module: 'AUTH',
          resourceId: userId,
          resourceType: 'UserSession',
          description: 'All other user sessions revoked',
          before,
          after: { revokedSessionIds: before.map((session) => session.id) },
        },
        tx,
      );
      return result;
    });
  }

  async verifyFederatedMfa(
    userId: string,
    providerVerified: boolean,
    otp?: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Federated account is not active');
    }
    if (providerVerified) return true;
    return user.twoFactorEnabled ? this.verifyMfaChallenge(user, otp) : false;
  }

  async issueFederatedSession(
    userId: string,
    authMethod: 'OIDC' | 'SAML',
    ipAddress: string,
    userAgent: string,
    mfaVerified = false,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: { select: { id: true, name: true, code: true } } },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Federated account is not active');
    }
    if (user.twoFactorEnabled && !mfaVerified) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Complete MFA before creating a session',
      });
    }
    const sessionId = crypto.randomUUID();
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId,
      sessionId,
      authMethod,
      mfaVerified,
    );
    await this.prisma.$transaction(async (tx) => {
      await this.createSession(
        user.id,
        tokens.refreshToken,
        ipAddress,
        userAgent,
        authMethod,
        mfaVerified,
        sessionId,
        tx,
      );
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
      });
      await this.audit.recordMutation(
        {
          userId: user.id,
          schoolId: user.schoolId,
          action: AuditAction.LOGIN,
          module: 'AUTH',
          resourceId: sessionId,
          resourceType: 'UserSession',
          description: `${authMethod} federated login session created`,
          before: null,
          after: { sessionId, authMethod },
          ipAddress,
        },
        tx,
      );
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        schoolId: user.schoolId,
        avatarUrl: user.avatarUrl,
        permissions: ROLE_PERMISSIONS[user.role] ?? [],
        school: user.school,
      },
      ...tokens,
      sessionId,
    };
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{
    devSimulation?: boolean;
    resetToken?: string;
    resetUrl?: string;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success (prevents email enumeration)
    if (!user) return null;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiry,
      },
    });

    const resetUrl = `${this.config.get('app.appUrl')}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordReset(
      user.email,
      user.firstName,
      resetUrl,
    );

    this.logger.log(`Password reset email sent to ${email}`);

    const isDev =
      process.env.ENABLE_DEV_AUTH_SIMULATION === 'true' &&
      this.config.get('app.nodeEnv') === 'development';
    if (isDev) {
      return {
        devSimulation: true,
        resetToken: rawToken,
        resetUrl,
      };
    }

    return null;
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordInput): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Password reset link is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>('app.bcryptRounds', 12),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
      // Revoke all sessions on password change
      const revoked = await tx.userSession.updateMany({
        where: { userId: user.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: user.id,
          revokeReason: 'Password reset',
        },
      });
      await this.audit.recordMutation(
        {
          userId: user.id,
          schoolId: user.schoolId,
          action: AuditAction.PASSWORD_CHANGE,
          module: 'AUTH',
          resourceId: user.id,
          resourceType: 'User',
          description: 'Password reset completed and sessions revoked',
          before: { passwordResetPending: true },
          after: {
            passwordResetPending: false,
            revokedSessionCount: revoked.count,
          },
        },
        tx,
      );
    });

    await this.emailService.sendPasswordChanged(user.email, user.firstName);

    this.logger.log(`Password reset for user ${user.email}`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    schoolId: string | null,
    sessionId: string,
    authMethod: AuthMethod,
    mfaVerified: boolean,
  ) {
    const payload = {
      sub: userId,
      email,
      role,
      schoolId,
      sessionId,
      authMethod,
      amr: [authMethod.toLowerCase(), ...(mfaVerified ? ['mfa'] : [])],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m') as any,
      }),
      this.jwtService.signAsync(
        {
          ...payload,
          tokenType: 'refresh',
          jti: crypto.randomBytes(16).toString('hex'),
        },
        {
          secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>(
            'jwt.refreshExpiresIn',
            '7d',
          ) as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
    authMethod: AuthMethod = AuthMethod.PASSWORD,
    mfaVerified = false,
    sessionId = crypto.randomUUID(),
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>(
          'jwt.refreshExpiresInMs',
          7 * 24 * 60 * 60 * 1000,
        ),
    );

    const tokenHash = hashRefreshToken(refreshToken);

    return database.userSession.create({
      data: {
        id: sessionId,
        userId,
        refreshToken: tokenHash,
        ipAddress,
        deviceInfo: this.parseDeviceInfo(userAgent),
        userAgent,
        expiresAt,
        status: 'ACTIVE',
        authMethod,
        mfaVerifiedAt: mfaVerified ? new Date() : null,
      },
    });
  }

  private async verifyMfaChallenge(
    user: {
      id: string;
      twoFactorSecret: string | null;
      mfaRecoveryCodes: Prisma.JsonValue | null;
    },
    token?: string,
  ): Promise<boolean> {
    if (!token) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Multi-factor authentication code is required',
      });
    }
    const secret = decryptSensitiveField(user.twoFactorSecret);
    if (secret && verifyTotp(secret, token)) return true;

    const hashed = this.hashRecoveryCode(token);
    const hashes = Array.isArray(user.mfaRecoveryCodes)
      ? user.mfaRecoveryCodes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    if (!hashes.includes(hashed)) {
      throw new UnauthorizedException('Invalid MFA or recovery code');
    }
    const consumed = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        // Optimistic compare-and-swap makes a recovery code truly one-time
        // even when two login attempts arrive concurrently.
        mfaRecoveryCodes: {
          equals: user.mfaRecoveryCodes as Prisma.InputJsonValue,
        },
      },
      data: { mfaRecoveryCodes: hashes.filter((item) => item !== hashed) },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Recovery code was already used');
    }
    return true;
  }

  private hashRecoveryCode(code: string): string {
    let pepper = this.config.get<string>('MFA_RECOVERY_CODE_PEPPER');
    if (!pepper && this.config.get<string>('app.nodeEnv') === 'production') {
      throw new Error('MFA_RECOVERY_CODE_PEPPER is required in production');
    }
    pepper ||= this.config.getOrThrow<string>('jwt.refreshSecret');
    return crypto
      .createHmac('sha256', pepper)
      .update(code.trim().toUpperCase())
      .digest('hex');
  }

  private async incrementFailedAttempts(userId: string) {
    // Use a single atomic update to prevent race conditions.
    // First, read the current count to determine if we should lock.
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });

    const currentCount = current?.failedLoginAttempts ?? 0;
    const willExceedLimit = currentCount + 1 >= 5;

    // Atomic single-write: increment AND conditionally set lockout in one operation
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: { increment: 1 },
        ...(willExceedLimit
          ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
          : {}),
      },
    });
  }

  private parseDeviceInfo(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('Mobile')) return 'Mobile Browser';
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    return 'Web Browser';
  }
}
