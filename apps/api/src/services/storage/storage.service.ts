import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageDriver: 'local' | 's3';
}

export interface FileStreamResult {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

/**
 * Storage Service Abstraction
 * Supports:
 *  - Local filesystem (dev / default private fallback)
 *  - AWS S3 / Cloudflare R2 / MinIO with SigV4 authentication
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly driver: 'local' | 's3';
  private readonly s3Bucket?: string;
  private readonly s3Endpoint?: string;
  private readonly s3PublicUrl?: string;
  private readonly s3Client?: S3Client;

  constructor(private config: ConfigService) {
    const configuredDriver =
      this.config.get<string>('STORAGE_DRIVER') ||
      this.config.get<string>('STORAGE_PROVIDER') ||
      'local';
    this.driver = configuredDriver.toLowerCase() as 'local' | 's3';
    this.uploadDir = this.config.get<string>(
      'STORAGE_LOCAL_PATH',
      path.join(process.cwd(), 'storage', 'uploads'),
    );
    this.s3Bucket =
      this.config.get<string>('S3_BUCKET_NAME') ||
      this.config.get<string>('AWS_S3_BUCKET');
    this.s3Endpoint = this.config.get<string>('S3_ENDPOINT');
    this.s3PublicUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');

    if (this.driver !== 'local' && this.driver !== 's3') {
      throw new InternalServerErrorException('Unsupported storage driver');
    }

    if (this.driver === 's3' && !this.s3Bucket) {
      throw new InternalServerErrorException(
        'S3 storage requires S3_BUCKET_NAME (or AWS_S3_BUCKET)',
      );
    }

    if (this.driver === 's3' && this.s3Bucket) {
      const region =
        this.config.get<string>('S3_REGION') ||
        this.config.get<string>('AWS_REGION') ||
        this.config.get<string>('AWS_S3_REGION') ||
        (this.s3Endpoint ? 'auto' : 'ap-south-1');
      const accessKeyId =
        this.config.get<string>('S3_ACCESS_KEY_ID') ||
        this.config.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey =
        this.config.get<string>('S3_SECRET_ACCESS_KEY') ||
        this.config.get<string>('AWS_SECRET_ACCESS_KEY');
      if (this.s3Endpoint) {
        const endpoint = new URL(this.s3Endpoint);
        if (
          endpoint.username ||
          endpoint.password ||
          (endpoint.protocol !== 'https:' &&
            this.config.get<string>('NODE_ENV') === 'production')
        )
          throw new InternalServerErrorException(
            'Private object storage requires a credential-free HTTPS endpoint',
          );
      }

      this.s3Client = new S3Client({
        region,
        endpoint: this.s3Endpoint,
        forcePathStyle: Boolean(this.s3Endpoint),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined,
      });
    }

    this.ensureUploadDir();
    this.logger.log(
      `StorageService initialized using [${this.driver.toUpperCase()}] driver`,
    );
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'general',
  ): Promise<UploadResult> {
    this.assertSafeFolder(folder);
    this.assertContentMatchesMimeType(buffer, mimeType);
    const ext = path.extname(originalName);
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;

    if (this.driver === 's3' && this.s3Bucket && this.s3Client) {
      try {
        const s3Key = `${folder}/${fileName}`;
        const command = new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
        });

        await this.s3Client.send(command);

        // Persist a private object locator, never a public CDN URL.
        const targetUrl = `s3://${this.s3Bucket}/${s3Key}`;

        this.logger.log(`Uploaded to S3: ${s3Key}`);
        return {
          url: targetUrl,
          fileName,
          fileSize: buffer.length,
          mimeType,
          storageDriver: 's3',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Cloud upload failed: ${msg}`);
        throw new InternalServerErrorException(
          'Cloud storage upload failed; refusing local fallback',
        );
      }
    }

    // Default Local Filesystem Driver (Stored privately)
    const filePath = this.localPath(`/uploads/${folder}/${fileName}`);
    const folderPath = path.dirname(filePath);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${folder}/${fileName}`;
    this.logger.log(`File uploaded locally: ${url}`);

    return {
      url,
      fileName,
      fileSize: buffer.length,
      mimeType,
      storageDriver: 'local',
    };
  }

  private extractS3Key(fileUrl: string): string {
    let s3Key: string;
    if (fileUrl.startsWith('s3://')) {
      const prefix = `s3://${this.s3Bucket}/`;
      if (!fileUrl.startsWith(prefix))
        throw new BadRequestException(
          'Object belongs to a different storage bucket',
        );
      s3Key = fileUrl.slice(prefix.length);
    } else {
      const urlObj = new URL(fileUrl);
      const bases = [
        this.s3PublicUrl,
        this.s3Endpoint
          ? `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}`
          : undefined,
      ].filter((value): value is string => Boolean(value));
      const base = bases
        .map((value) => new URL(value))
        .find(
          (value) =>
            value.origin === urlObj.origin &&
            urlObj.pathname.startsWith(value.pathname.replace(/\/$/, '') + '/'),
        );
      if (!base) throw new BadRequestException('Untrusted object-storage URL');
      s3Key = decodeURIComponent(
        urlObj.pathname.slice(base.pathname.replace(/\/$/, '').length + 1),
      );
    }
    if (
      !s3Key ||
      s3Key.includes('\\') ||
      s3Key.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new BadRequestException('Invalid object key');
    return s3Key;
  }

  private assertSafeFolder(folder: string) {
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(folder))
      throw new BadRequestException('Invalid upload folder');
  }

  private localPath(fileUrl: string) {
    if (
      !fileUrl.startsWith('/uploads/') ||
      fileUrl.includes('\\') ||
      fileUrl.includes('\0')
    )
      throw new BadRequestException('Invalid private file locator');
    const relative = fileUrl.slice('/uploads/'.length);
    if (
      relative.split('/').some((part) => !part || part === '..' || part === '.')
    )
      throw new BadRequestException(
        'Invalid file path (path traversal detected)',
      );
    const base = path.resolve(this.uploadDir);
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep))
      throw new BadRequestException('Invalid private file path');
    let ancestor = target;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const realAncestor = fs.realpathSync(ancestor);
    const realBase = fs.realpathSync(base);
    if (
      realAncestor !== realBase &&
      !realAncestor.startsWith(realBase + path.sep)
    )
      throw new BadRequestException(
        'Storage symlink escapes the upload directory',
      );
    return target;
  }

  async getFileStream(fileUrl: string): Promise<FileStreamResult> {
    if (
      (fileUrl.startsWith('http') || fileUrl.startsWith('s3://')) &&
      this.driver === 's3' &&
      this.s3Bucket &&
      this.s3Client
    ) {
      const s3Key = this.extractS3Key(fileUrl);
      try {
        const command = new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
        });
        const response = await this.s3Client.send(command);

        if (!response.Body) {
          throw new NotFoundException('Object body not returned from S3');
        }

        return {
          stream: response.Body as Readable,
          fileName: path.basename(s3Key),
          mimeType: response.ContentType || 'application/octet-stream',
          fileSize: response.ContentLength,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to stream from S3: ${msg}`);
        throw new NotFoundException(
          'Requested file not found in cloud storage',
        );
      }
    }

    // Local filesystem stream with path traversal protection
    const filePath = this.localPath(fileUrl);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Requested file not found on local storage');
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };

    return {
      stream: fs.createReadStream(filePath),
      fileName,
      mimeType: mimeMap[ext] || 'application/octet-stream',
      fileSize: stat.size,
    };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (
      (fileUrl.startsWith('http') || fileUrl.startsWith('s3://')) &&
      this.driver === 's3' &&
      this.s3Bucket &&
      this.s3Client
    ) {
      const s3Key = this.extractS3Key(fileUrl);
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
        });
        await this.s3Client.send(command);
        this.logger.log(`Deleted S3 object: ${s3Key}`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete S3 object: ${msg}`);
        throw new InternalServerErrorException(
          'Cloud object deletion failed; document state was not changed',
        );
      }
    }

    // Local filesystem deletion with path traversal protection
    const filePath = this.localPath(fileUrl);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted locally: ${fileUrl}`);
    }
  }

  async generatePresignedUploadUrl(
    folder: string,
    fileName: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    this.assertSafeFolder(folder);
    if (fileName !== path.basename(fileName) || /[\\/\0]/.test(fileName))
      throw new BadRequestException('Invalid upload file name');
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900)
      throw new BadRequestException(
        'Upload URL expiry must be between 1 and 900 seconds',
      );
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException(
        'S3 driver is not configured for presigned uploads',
      );
    }

    const key = `${folder}/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    return { uploadUrl, fileKey: key };
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Do not trust multipart MIME metadata alone. The public document endpoints
   * allow only a small set of binary formats, so reject a file whose magic
   * bytes contradict its declared type before it reaches persistent storage.
   */
  private assertContentMatchesMimeType(buffer: Buffer, mimeType: string): void {
    const matches = (signature: number[]) =>
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte);

    const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const isPng = matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isJpeg = matches([0xff, 0xd8, 0xff]);
    const isZip =
      matches([0x50, 0x4b, 0x03, 0x04]) || matches([0x50, 0x4b, 0x05, 0x06]);

    const valid =
      (mimeType === 'application/pdf' && isPdf) ||
      (mimeType === 'image/png' && isPng) ||
      (mimeType === 'image/jpeg' && isJpeg) ||
      (mimeType === 'application/zip' && isZip) ||
      (mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
        isZip) ||
      ![
        'application/pdf',
        'image/png',
        'image/jpeg',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(mimeType);

    if (!valid) {
      throw new BadRequestException(
        'Uploaded file content does not match its declared file type',
      );
    }
  }
}
