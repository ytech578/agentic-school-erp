import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { sanitizeAuditSnapshot } from './audit-snapshot';

export interface TransactionalAuditEntry {
  schoolId: string | null;
  userId: string;
  action: AuditAction;
  module: string;
  description: string;
  resourceId?: string | null;
  resourceType?: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records immutable before/after state on the current Prisma transaction.
   * Call this from the same transaction that performs the domain mutation.
   */
  async recordMutation(
    entry: TransactionalAuditEntry,
    transaction?: Prisma.TransactionClient,
  ) {
    const database = transaction ?? this.prisma;
    const queryRawUnsafe = (
      database as unknown as {
        $queryRawUnsafe?: (
          query: string,
          ...values: unknown[]
        ) => Promise<unknown>;
      }
    ).$queryRawUnsafe;
    if (queryRawUnsafe) {
      await queryRawUnsafe.call(
        database,
        // PostgreSQL returns `void` from pg_advisory_xact_lock. Prisma cannot
        // deserialize a void column (P2010), so invoke the lock as a table
        // function and project a supported scalar instead.
        'SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended($1, 0))',
        entry.schoolId ?? 'platform',
      );
    }
    const previous = await database.activityLog.findFirst({
      where: { schoolId: entry.schoolId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { integrityHash: true },
    });
    const previousHash = previous?.integrityHash ?? null;
    const before = this.toJson(entry.before);
    const after = this.toJson(entry.after);
    const createdAt = new Date();
    const integrityHash = createHash('sha256')
      .update(
        this.canonicalJson({
          previousHash,
          schoolId: entry.schoolId,
          userId: entry.userId,
          action: entry.action,
          module: entry.module,
          resourceId: entry.resourceId ?? null,
          resourceType: entry.resourceType ?? null,
          description: entry.description,
          before,
          after,
          createdAt: createdAt.toISOString(),
        }),
      )
      .digest('hex');

    return database.activityLog.create({
      data: {
        schoolId: entry.schoolId,
        userId: entry.userId,
        action: entry.action,
        module: entry.module,
        resourceId: entry.resourceId,
        resourceType: entry.resourceType,
        description: entry.description,
        before,
        after,
        requestId: entry.requestId,
        correlationId: entry.correlationId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        previousHash,
        integrityHash,
        createdAt,
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (value === undefined || value === null) return Prisma.DbNull;
    return sanitizeAuditSnapshot(value) as Prisma.InputJsonValue;
  }

  private canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonicalJson(object[key])}`)
      .join(',')}}`;
  }
}
