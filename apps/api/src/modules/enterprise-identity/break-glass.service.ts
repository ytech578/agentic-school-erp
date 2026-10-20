import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RunWithSystemDatabaseContext } from '../../core/database/system-database-context.decorator';

@Injectable()
export class BreakGlassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  @RunWithSystemDatabaseContext()
  async expireElapsedGrants() {
    const elapsed = await this.prisma.breakGlassGrant.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      take: 200,
    });
    let expiredCount = 0;
    for (const grant of elapsed) {
      const expired = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.breakGlassGrant.updateMany({
          where: {
            id: grant.id,
            status: 'ACTIVE',
            expiresAt: { lte: new Date() },
          },
          data: { status: 'EXPIRED' },
        });
        if (changed.count !== 1) return false;
        const updated = await tx.breakGlassGrant.findUniqueOrThrow({
          where: { id: grant.id },
        });
        await this.audit.recordMutation(
          {
            schoolId: grant.schoolId,
            userId: grant.requesterId,
            action: AuditAction.UPDATE,
            module: 'BREAK_GLASS',
            resourceId: grant.id,
            resourceType: 'BreakGlassGrant',
            description: 'Emergency tenant access expired automatically',
            before: grant,
            after: updated,
          },
          tx,
        );
        return true;
      });
      if (expired) expiredCount += 1;
    }
    return { count: expiredCount };
  }

  list() {
    return this.prisma.breakGlassGrant.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
      },
      take: 200,
    });
  }

  async request(requesterId: string, schoolId: string, reason: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException('School not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended($1, 0))',
        `break-glass:${requesterId}:${schoolId}`,
      );
      const existing = await tx.breakGlassGrant.findFirst({
        where: {
          requesterId,
          schoolId,
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      });
      if (existing) {
        throw new BadRequestException(
          'A pending or active grant already exists',
        );
      }
      const grant = await tx.breakGlassGrant.create({
        data: { requesterId, schoolId, reason },
      });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: requesterId,
          action: AuditAction.CREATE,
          module: 'BREAK_GLASS',
          resourceId: grant.id,
          resourceType: 'BreakGlassGrant',
          description: 'Emergency tenant access requested',
          before: null,
          after: grant,
        },
        tx,
      );
      return grant;
    });
  }

  async approve(grantId: string, approverId: string, durationMinutes: number) {
    const grant = await this.prisma.breakGlassGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Break-glass request not found');
    if (grant.status !== 'PENDING')
      throw new BadRequestException('Request is not pending');
    if (grant.requesterId === approverId) {
      throw new BadRequestException(
        'Dual control requires a different approver',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.breakGlassGrant.updateMany({
        where: { id: grantId, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          approverId,
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + durationMinutes * 60_000),
        },
      });
      if (changed.count !== 1) {
        throw new BadRequestException('Request is no longer pending');
      }
      const updated = await tx.breakGlassGrant.findUniqueOrThrow({
        where: { id: grantId },
      });
      await this.audit.recordMutation(
        {
          schoolId: grant.schoolId,
          userId: approverId,
          action: AuditAction.UPDATE,
          module: 'BREAK_GLASS',
          resourceId: grant.id,
          resourceType: 'BreakGlassGrant',
          description: 'Emergency tenant access approved with dual control',
          before: grant,
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async revoke(grantId: string, actorId: string, reason: string) {
    const grant = await this.prisma.breakGlassGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Break-glass grant not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.breakGlassGrant.update({
        where: { id: grantId },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokeReason: reason,
        },
      });
      await this.audit.recordMutation(
        {
          schoolId: grant.schoolId,
          userId: actorId,
          action: AuditAction.UPDATE,
          module: 'BREAK_GLASS',
          resourceId: grant.id,
          resourceType: 'BreakGlassGrant',
          description: 'Emergency tenant access revoked',
          before: grant,
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }
}
