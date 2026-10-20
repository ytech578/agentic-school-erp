import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, Prisma } from '@prisma/client';
import { z } from 'zod';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthenticatedRequest } from '../../core/types/auth-request.interface';
import { DocumentSecurityService } from './document-security.service';
import { StorageService } from './storage.service';

const Kind = z.enum(['student', 'admission']);
const metadata = {
  id: true,
  fileName: true,
  scanStatus: true,
  quarantineReason: true,
  legalHold: true,
  retainedUntil: true,
  scannedAt: true,
  uploadedAt: true,
  deletedAt: true,
} as const;

@ApiTags('Document Security')
@ApiBearerAuth('JWT-auth')
@Controller('document-security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
export class DocumentSecurityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: DocumentSecurityService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private school(request: AuthenticatedRequest) {
    if (!request.user.schoolId)
      throw new BadRequestException(
        'Select a school to manage document security',
      );
    return request.user.schoolId;
  }

  private async document(
    schoolId: string,
    kind: 'student' | 'admission',
    id: string,
    database: Prisma.TransactionClient = this.prisma,
  ) {
    const doc =
      kind === 'student'
        ? await database.studentDocument.findFirst({
            where: { id, student: { schoolId }, deletedAt: null },
          })
        : await database.admissionDocument.findFirst({
            where: { id, application: { schoolId }, deletedAt: null },
          });
    if (!doc) throw new NotFoundException('Document not found in this school');
    return doc;
  }

  private async lockDocument(
    database: Prisma.TransactionClient,
    kind: 'student' | 'admission',
    id: string,
  ) {
    const table =
      kind === 'student' ? 'student_documents' : 'admission_documents';
    await database.$queryRawUnsafe(
      `SELECT id FROM public.${table} WHERE id=$1 FOR UPDATE`,
      id,
    );
  }

  @Get()
  async list(@Request() request: AuthenticatedRequest) {
    const schoolId = this.school(request);
    const [students, admissions] = await Promise.all([
      this.prisma.studentDocument.findMany({
        where: { student: { schoolId }, deletedAt: null },
        select: metadata,
        orderBy: { uploadedAt: 'desc' },
        take: 100,
      }),
      this.prisma.admissionDocument.findMany({
        where: { application: { schoolId }, deletedAt: null },
        select: metadata,
        orderBy: { uploadedAt: 'desc' },
        take: 100,
      }),
    ]);
    return [
      ...students.map((doc) => ({ ...doc, kind: 'student' })),
      ...admissions.map((doc) => ({ ...doc, kind: 'admission' })),
    ];
  }

  @Patch(':kind/:id/policy')
  async policy(
    @Request() request: AuthenticatedRequest,
    @Param('kind') rawKind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const kind = Kind.parse(rawKind);
    const schoolId = this.school(request);
    const dto = z
      .object({
        legalHold: z.boolean().optional(),
        retainedUntil: z.string().datetime().optional(),
        reason: z.string().trim().min(20).max(1000),
      })
      .refine(
        (value) =>
          value.legalHold !== undefined || value.retainedUntil !== undefined,
        'Provide a policy change',
      )
      .parse(body);
    return this.prisma.$transaction(async (tx) => {
      await this.lockDocument(tx, kind, id);
      const before = await this.document(schoolId, kind, id, tx);
      const retainedUntil = dto.retainedUntil
        ? new Date(dto.retainedUntil)
        : undefined;
      if (
        retainedUntil &&
        (retainedUntil <= new Date() ||
          (before.retainedUntil && retainedUntil < before.retainedUntil))
      ) {
        throw new BadRequestException(
          'Retention may only be extended to a future date',
        );
      }
      const data = { legalHold: dto.legalHold, retainedUntil };
      const after =
        kind === 'student'
          ? await tx.studentDocument.update({ where: { id }, data })
          : await tx.admissionDocument.update({ where: { id }, data });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: request.user.id,
          action: AuditAction.UPDATE,
          module: 'DOCUMENT_SECURITY',
          resourceId: id,
          resourceType: `${kind}Document`,
          description: dto.reason,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  @Post(':kind/:id/rescan')
  async rescan(
    @Request() request: AuthenticatedRequest,
    @Param('kind') rawKind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const kind = Kind.parse(rawKind);
    const schoolId = this.school(request);
    const dto = z
      .object({ reason: z.string().trim().min(20).max(1000) })
      .parse(body);
    const before = await this.document(schoolId, kind, id);
    const file = await this.storage.getFileStream(before.fileUrl);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of file.stream as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > 10 * 1024 * 1024)
        throw new BadRequestException('Document exceeds the scan size limit');
      chunks.push(Buffer.from(chunk));
    }
    const scan = await this.scanner.scan(Buffer.concat(chunks));
    const mismatch = Boolean(before.sha256 && before.sha256 !== scan.sha256);
    const clean = scan.status === 'CLEAN' && !mismatch;
    return this.prisma.$transaction(async (tx) => {
      await this.lockDocument(tx, kind, id);
      const current = await this.document(schoolId, kind, id, tx);
      if (
        current.fileUrl !== before.fileUrl ||
        current.sha256 !== before.sha256
      )
        throw new BadRequestException(
          'The document changed during scanning; retry the scan',
        );
      const data = {
        scanStatus: clean ? ('CLEAN' as const) : ('QUARANTINED' as const),
        scanEngine: scan.engine,
        scanResult: scan.details as Prisma.InputJsonValue,
        scannedAt: new Date(),
        sha256: before.sha256 || scan.sha256,
        quarantineReason: clean
          ? null
          : mismatch
            ? 'Stored document checksum changed'
            : scan.reason || 'No clean scan verdict',
      };
      const after =
        kind === 'student'
          ? await tx.studentDocument.update({ where: { id }, data })
          : await tx.admissionDocument.update({ where: { id }, data });
      await this.audit.recordMutation(
        {
          schoolId,
          userId: request.user.id,
          action: AuditAction.UPDATE,
          module: 'DOCUMENT_SECURITY',
          resourceId: id,
          resourceType: `${kind}Document`,
          description: dto.reason,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }
}
