import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from './storage.service';

export interface DocumentScanResult {
  status: 'CLEAN' | 'INFECTED' | 'ERROR' | 'QUARANTINED';
  sha256: string;
  engine: string;
  reason?: string;
  details: Record<string, unknown>;
}

@Injectable()
export class DocumentSecurityService {
  private readonly logger = new Logger(DocumentSecurityService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async scan(buffer: Buffer): Promise<DocumentScanResult> {
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    if (buffer.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))) {
      return {
        status: 'INFECTED',
        sha256,
        engine: 'built-in-eicar',
        reason: 'EICAR test signature detected',
        details: { signature: 'EICAR-Test-Signature' },
      };
    }

    const host = this.config.get<string>('CLAMAV_HOST');
    const required =
      this.config.get<string>('MALWARE_SCAN_REQUIRED') === 'true' ||
      this.config.get<string>('app.nodeEnv') === 'production';
    if (!host) {
      if (required) {
        throw new ServiceUnavailableException(
          'Malware scanner is required but CLAMAV_HOST is not configured',
        );
      }
      return {
        status: 'CLEAN',
        sha256,
        engine: 'development-signature-gate',
        details: { warning: 'ClamAV is disabled outside production' },
      };
    }

    try {
      const response = await this.scanWithClamAv(
        buffer,
        host,
        this.config.get<number>('CLAMAV_PORT', 3310),
      );
      const infected = response.includes('FOUND');
      if (!infected && !/^stream:\s*OK$/.test(response)) {
        throw new Error('ClamAV did not return an explicit clean verdict');
      }
      return {
        status: infected ? 'INFECTED' : 'CLEAN',
        sha256,
        engine: 'clamav',
        reason: infected ? response : undefined,
        details: { response },
      };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      if (required) {
        throw new ServiceUnavailableException(
          `Malware scanner unavailable: ${reason}`,
        );
      }
      this.logger.warn(`ClamAV unavailable; quarantining upload: ${reason}`);
      return {
        status: 'ERROR',
        sha256,
        engine: 'clamav',
        reason,
        details: { response: reason },
      };
    }
  }

  retentionDate() {
    const days = this.config.get<number>('DOCUMENT_RETENTION_DAYS', 2555);
    return new Date(Date.now() + days * 86_400_000);
  }

  @Cron('0 30 2 * * *')
  async enforceRetention() {
    const [studentDocuments, admissionDocuments] =
      await this.prisma.runAsSystem(async () => {
        const now = new Date();
        return Promise.all([
          this.prisma.studentDocument.findMany({
            where: {
              retainedUntil: { lte: now },
              legalHold: false,
              deletedAt: null,
            },
            select: { id: true, fileUrl: true },
            take: 500,
          }),
          this.prisma.admissionDocument.findMany({
            where: {
              retainedUntil: { lte: now },
              legalHold: false,
              deletedAt: null,
            },
            select: { id: true, fileUrl: true },
            take: 500,
          }),
        ]);
      });
    let purged = 0;
    for (const [kind, documents] of [
      ['student', studentDocuments],
      ['admission', admissionDocuments],
    ] as const) {
      for (const document of documents) {
        try {
          const removed = await this.prisma.runAsSystem(async () => {
            // A row lock serializes hold changes with purge and prevents two
            // API replicas from deleting the same object concurrently.
            const table =
              kind === 'student' ? 'student_documents' : 'admission_documents';
            const eligible = await this.prisma.$queryRawUnsafe<
              Array<{ id: string; fileUrl: string }>
            >(
              `SELECT id, "fileUrl" FROM public.${table} WHERE id=$1 AND "legalHold"=false AND "deletedAt" IS NULL AND "retainedUntil"<=CURRENT_TIMESTAMP FOR UPDATE SKIP LOCKED`,
              document.id,
            );
            if (!eligible.length) return false;
            await this.storage.deleteFile(eligible[0].fileUrl);
            if (kind === 'student')
              await this.prisma.studentDocument.update({
                where: { id: document.id },
                data: { deletedAt: new Date() },
              });
            else
              await this.prisma.admissionDocument.update({
                where: { id: document.id },
                data: { deletedAt: new Date() },
              });
            return true;
          });
          if (removed) purged++;
        } catch {
          this.logger.error(
            `Retention purge failed for ${kind} document ${document.id}; it remains eligible for retry`,
          );
        }
      }
    }
    if (purged)
      this.logger.log(`Retention purge removed ${purged} document objects`);
    return { purged };
  }

  private scanWithClamAv(
    buffer: Buffer,
    host: string,
    port: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      const timeoutMs = this.config.get<number>('CLAMAV_TIMEOUT_MS', 15_000);
      socket.setTimeout(timeoutMs);
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('error', reject);
      socket.on('timeout', () =>
        socket.destroy(new Error('ClamAV scan timed out')),
      );
      socket.on('close', (hadError) => {
        if (hadError) return;
        const response = Buffer.concat(chunks)
          .toString('utf8')
          .replace(/\0/g, '')
          .trim();
        if (!response)
          return reject(new Error('ClamAV returned an empty response'));
        resolve(response);
      });
      socket.connect(port, host, () => {
        socket.write('zINSTREAM\0');
        const chunkSize = 64 * 1024;
        for (let offset = 0; offset < buffer.length; offset += chunkSize) {
          const chunk = buffer.subarray(offset, offset + chunkSize);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
    });
  }
}
