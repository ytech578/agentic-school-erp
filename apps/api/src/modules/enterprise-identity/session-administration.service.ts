import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class SessionAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async requireRecentMfa(actorId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: actorId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        mfaVerifiedAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
      select: { id: true },
    });
    if (!session)
      throw new ForbiddenException(
        'Sign in with MFA within the last 10 minutes to perform this privileged action',
      );
  }

  private async target(schoolId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found in this school');
    if (user.role === 'SUPER_ADMIN')
      throw new ForbiddenException(
        'Platform administrator sessions cannot be managed through a school',
      );
  }

  async list(schoolId: string, userId: string) {
    await this.target(schoolId, userId);
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        deviceInfo: true,
        ipAddress: true,
        authMethod: true,
        mfaVerifiedAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
      },
    });
  }

  async revoke(
    schoolId: string,
    userId: string,
    actorId: string,
    sessionId: string,
    reason: string,
  ) {
    await this.requireRecentMfa(actorId, sessionId);
    await this.target(schoolId, userId);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.userSession.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, status: true },
      });
      const result = await tx.userSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: actorId,
          revokeReason: reason,
        },
      });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: actorId,
          action: AuditAction.UPDATE,
          module: 'SESSION_ADMINISTRATION',
          resourceId: userId,
          resourceType: 'UserSession',
          description: reason,
          before,
          after: { revokedSessionIds: before.map((item) => item.id) },
        },
        tx,
      );
      return result;
    });
  }
}
