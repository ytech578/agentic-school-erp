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
import { PrismaService } from '../../core/database/prisma.service';
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

    // Reset failed attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId,
    );

    // Store session
    const session = await this.createSession(
      user.id,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    // Audit log
    await this.createAuditLog(user.id, user.schoolId, 'LOGIN', ipAddress);

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
      sessionId: session.id,
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshToken: tokenHash, userId },
      data: { status: 'REVOKED' },
    });
    await this.createAuditLog(userId, null, 'LOGOUT', null);
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
      permissions: ROLE_PERMISSIONS[user.role] ?? [],
      school: user.school,
    };
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success (prevents email enumeration)
    if (!user) return;

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

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      // Revoke all sessions on password change
      this.prisma.userSession.updateMany({
        where: { userId: user.id },
        data: { status: 'REVOKED' },
      }),
    ]);

    await this.createAuditLog(user.id, user.schoolId, 'PASSWORD_CHANGE', null);
    await this.emailService.sendPasswordChanged(user.email, user.firstName);

    this.logger.log(`Password reset for user ${user.email}`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    schoolId: string | null,
  ) {
    const payload = { sub: userId, email, role, schoolId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m') as any,
      }),
      // Refresh token is a random secure token stored as hash
      Promise.resolve(crypto.randomBytes(64).toString('hex')),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>(
          'jwt.refreshExpiresInMs',
          7 * 24 * 60 * 60 * 1000,
        ),
    );

    const tokenHash = hashRefreshToken(refreshToken);

    return this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: tokenHash,
        ipAddress,
        deviceInfo: this.parseDeviceInfo(userAgent),
        userAgent,
        expiresAt,
        status: 'ACTIVE',
      },
    });
  }

  private async incrementFailedAttempts(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    // Lock account after 5 failed attempts for 15 minutes
    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
    }
  }

  private async createAuditLog(
    userId: string,
    schoolId: string | null,
    action: string,
    ipAddress: string | null,
  ) {
    await this.prisma.activityLog.create({
      data: {
        userId,
        schoolId,
        action: action as any,
        module: 'auth',
        description: `User ${action.toLowerCase()}`,
        ipAddress,
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
