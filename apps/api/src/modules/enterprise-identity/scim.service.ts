import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { sanitizeAuditSnapshot } from '../../core/audit/audit-snapshot';

const ScimUserSchema = z.object({
  userName: z.string().email().max(254),
  externalId: z.string().max(255).optional(),
  active: z.boolean().optional(),
  name: z.object({
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
  }),
  roles: z
    .array(z.union([z.string(), z.object({ value: z.string().optional() })]))
    .max(10)
    .optional(),
});

interface ScimUserInput {
  externalId?: string;
  userName: string;
  active?: boolean;
  name?: { givenName?: string; familyName?: string };
  roles?: Array<{ value?: string } | string>;
}

@Injectable()
export class ScimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  listTokens(schoolId?: string) {
    return this.prisma.scimAccessToken.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        schoolId: true,
        name: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdById: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }

  async createToken(
    actorId: string,
    schoolId: string,
    name: string,
    expiresAt?: string,
  ) {
    const rawToken = `scim_${randomBytes(32).toString('base64url')}`;
    const record = await this.prisma.scimAccessToken.create({
      data: {
        schoolId,
        name,
        createdById: actorId,
        tokenHash: this.hashToken(rawToken),
        scopes: ['scim:users'],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return { id: record.id, token: rawToken, expiresAt: record.expiresAt };
  }

  async revokeToken(actorId: string, tokenId: string, schoolId?: string) {
    const before = await this.prisma.scimAccessToken.findFirst({
      where: { id: tokenId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!before) throw new NotFoundException('SCIM token not found');
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.scimAccessToken.update({
        where: { id: tokenId },
        data: { isActive: false, revokedAt: new Date() },
      });
      await this.audit.recordMutation(
        {
          schoolId: before.schoolId,
          userId: actorId,
          action: AuditAction.UPDATE,
          module: 'SCIM',
          resourceId: tokenId,
          resourceType: 'ScimAccessToken',
          description: 'SCIM bearer token revoked',
          before: { isActive: before.isActive },
          after: { isActive: after.isActive, revokedAt: after.revokedAt },
        },
        tx,
      );
      return after;
    });
  }

  async authenticate(rawToken: string) {
    const token = await this.prisma.runAsSystem(() =>
      this.prisma.scimAccessToken.findUnique({
        where: { tokenHash: this.hashToken(rawToken) },
      }),
    );
    if (
      !token ||
      !token.isActive ||
      token.revokedAt ||
      (token.expiresAt && token.expiresAt <= new Date()) ||
      !token.scopes.includes('scim:users')
    ) {
      return null;
    }
    await this.prisma.runAsSystem(() =>
      this.prisma.scimAccessToken.update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      }),
    );
    return token;
  }

  async listUsers(
    schoolId: string,
    filter?: string,
    startIndex = 1,
    count = 100,
  ) {
    if (
      !Number.isInteger(startIndex) ||
      startIndex < 1 ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      throw new BadRequestException(
        'startIndex must be a positive integer and count a nonnegative integer',
      );
    }
    const match = filter?.match(/^userName\s+eq\s+"([^"]+)"$/i);
    if (filter && !match) {
      throw new BadRequestException(
        'Only userName eq "value" filtering is supported',
      );
    }
    const where: Prisma.UserWhereInput = {
      schoolId,
      ...(match ? { email: match[1].toLowerCase() } : {}),
    };
    const [users, totalResults] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: Math.max(startIndex - 1, 0),
        take: Math.min(count, 200),
        orderBy: { email: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: users.length,
      Resources: users.map((user) => this.toScimUser(user)),
    };
  }

  async getUser(schoolId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, schoolId } });
    if (!user) throw new NotFoundException('SCIM user not found');
    return this.toScimUser(user);
  }

  async createUser(schoolId: string, actorId: string, input: ScimUserInput) {
    input = ScimUserSchema.parse(input);
    if (!input.userName || !input.name?.givenName || !input.name?.familyName) {
      throw new BadRequestException('userName and complete name are required');
    }
    const role = this.readRole(input.roles);
    const passwordHash = await bcrypt.hash(
      randomBytes(48).toString('base64url'),
      this.config.get<number>('app.bcryptRounds', 12),
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            schoolId,
            scimExternalId: input.externalId,
            email: input.userName.toLowerCase(),
            firstName: input.name!.givenName!,
            lastName: input.name!.familyName!,
            role,
            status: input.active === false ? 'INACTIVE' : 'ACTIVE',
            emailVerified: true,
            passwordHash,
          },
        });
        await this.audit.recordMutation(
          {
            schoolId,
            userId: actorId,
            action: AuditAction.CREATE,
            module: 'SCIM',
            resourceId: user.id,
            resourceType: 'User',
            description: 'User provisioned through SCIM',
            before: null,
            after: this.safeSnapshot(user),
          },
          tx,
        );
        return this.toScimUser(user);
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'SCIM userName or externalId already exists',
        );
      }
      throw error;
    }
  }

  async patchUser(
    schoolId: string,
    actorId: string,
    id: string,
    body: {
      Operations?: Array<{ op?: string; path?: string; value?: unknown }>;
    },
  ) {
    const data: Prisma.UserUpdateInput = {};
    const operations = z
      .array(
        z.object({
          op: z.string(),
          path: z.string().optional(),
          value: z.unknown(),
        }),
      )
      .min(1)
      .max(100)
      .parse(body.Operations);
    const apply = (path: string, value: unknown) => {
      switch (path.toLowerCase()) {
        case 'active':
          data.status = z.boolean().parse(value) ? 'ACTIVE' : 'INACTIVE';
          break;
        case 'username':
          data.email = z.string().email().max(254).parse(value).toLowerCase();
          break;
        case 'name.givenname':
          data.firstName = z.string().trim().min(1).max(100).parse(value);
          break;
        case 'name.familyname':
          data.lastName = z.string().trim().min(1).max(100).parse(value);
          break;
        case 'externalid':
          data.scimExternalId = z.string().max(255).parse(value);
          break;
        case 'name': {
          const name = z
            .object({
              givenName: z.string().trim().min(1).max(100).optional(),
              familyName: z.string().trim().min(1).max(100).optional(),
            })
            .parse(value);
          if (name.givenName !== undefined) data.firstName = name.givenName;
          if (name.familyName !== undefined) data.lastName = name.familyName;
          break;
        }
        default:
          throw new BadRequestException(`Unsupported SCIM patch path: ${path}`);
      }
    };
    for (const operation of operations) {
      if (!['replace', 'add'].includes(operation.op.toLowerCase())) {
        throw new BadRequestException(
          'Only add and replace are supported for these required user attributes',
        );
      }
      if (operation.path) apply(operation.path, operation.value);
      else {
        const values = z.record(z.string(), z.unknown()).parse(operation.value);
        for (const [key, value] of Object.entries(values)) apply(key, value);
      }
    }
    return this.persistUpdate(schoolId, actorId, id, data);
  }

  async replaceUser(
    schoolId: string,
    actorId: string,
    id: string,
    input: ScimUserInput,
  ) {
    const dto = ScimUserSchema.parse(input);
    return this.persistUpdate(schoolId, actorId, id, {
      email: dto.userName.toLowerCase(),
      firstName: dto.name.givenName,
      lastName: dto.name.familyName,
      scimExternalId: dto.externalId ?? null,
      status: dto.active === false ? 'INACTIVE' : 'ACTIVE',
      role: this.readRole(dto.roles),
    });
  }

  private async persistUpdate(
    schoolId: string,
    actorId: string,
    id: string,
    data: Prisma.UserUpdateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({ where: { id, schoolId } });
      if (!before) throw new NotFoundException('SCIM user not found');
      const after = await tx.user.update({ where: { id }, data });
      if (after.status !== 'ACTIVE') {
        await tx.userSession.updateMany({
          where: { userId: id, status: 'ACTIVE' },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokeReason: 'SCIM account deactivated',
          },
        });
      }
      await this.audit.recordMutation(
        {
          schoolId,
          userId: actorId,
          action: AuditAction.UPDATE,
          module: 'SCIM',
          resourceId: id,
          resourceType: 'User',
          description: 'User updated through SCIM',
          before: this.safeSnapshot(before),
          after: this.safeSnapshot(after),
        },
        tx,
      );
      return this.toScimUser(after);
    });
  }

  async deleteUser(schoolId: string, actorId: string, id: string) {
    const before = await this.prisma.user.findFirst({
      where: { id, schoolId },
    });
    if (!before) throw new NotFoundException('SCIM user not found');
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      await tx.userSession.updateMany({
        where: { userId: id, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokeReason: 'SCIM deprovisioning',
        },
      });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: actorId,
          action: AuditAction.DELETE,
          module: 'SCIM',
          resourceId: id,
          resourceType: 'User',
          description: 'User deprovisioned through SCIM',
          before: this.safeSnapshot(before),
          after: this.safeSnapshot(after),
        },
        tx,
      );
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private readRole(roles?: ScimUserInput['roles']): UserRole {
    const raw = roles?.[0];
    const value = typeof raw === 'string' ? raw : raw?.value;
    const allowed: UserRole[] = [
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ];
    return allowed.includes(value as UserRole)
      ? (value as UserRole)
      : 'TEACHER';
  }

  private safeSnapshot(user: Record<string, unknown>) {
    return sanitizeAuditSnapshot(user);
  }

  private toScimUser(user: {
    id: string;
    scimExternalId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.scimExternalId ?? undefined,
      userName: user.email,
      active: user.status === 'ACTIVE',
      name: { givenName: user.firstName, familyName: user.lastName },
      emails: [{ value: user.email, primary: true }],
      roles: [{ value: user.role, primary: true }],
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
      },
    };
  }
}
