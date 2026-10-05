import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
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
    this.driver =
      (this.config.get<string>('STORAGE_DRIVER', 'local').toLowerCase() as
        'local' | 's3') || 'local';
    this.uploadDir = this.config.get<string>(
      'STORAGE_LOCAL_PATH',
      path.join(process.cwd(), 'storage', 'uploads'),
    );
    this.s3Bucket = this.config.get<string>('S3_BUCKET_NAME');
    this.s3Endpoint = this.config.get<string>('S3_ENDPOINT');
    this.s3PublicUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');

    if (this.driver === 's3' && this.s3Bucket) {
      const region = this.config.get<string>('AWS_REGION', 'ap-south-1');
      const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

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
    const ext = path.extname(originalName);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;

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

        const targetUrl = this.s3PublicUrl
          ? `${this.s3PublicUrl.replace(/\/$/, '')}/${s3Key}`
          : `s3://${this.s3Bucket}/${s3Key}`;

        this.logger.log(`Uploaded to S3: ${s3Key}`);
        return {
          url: targetUrl,
          fileName,
          fileSize: buffer.length,
          mimeType,
          storageDriver: 's3',
        };
      } catch (err: any) {
        this.logger.warn(
          `S3 upload failed, falling back to local storage: ${err.message}`,
        );
      }
    }

    // Default Local Filesystem Driver (Stored privately)
    const folderPath = path.join(this.uploadDir, folder);
    const filePath = path.join(folderPath, fileName);

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

  async getFileStream(fileUrl: string): Promise<FileStreamResult> {
    if (
      (fileUrl.startsWith('http') || fileUrl.startsWith('s3://')) &&
      this.driver === 's3' &&
      this.s3Bucket &&
      this.s3Client
    ) {
      try {
        let s3Key = fileUrl;
        if (fileUrl.startsWith('s3://')) {
          s3Key = fileUrl.replace(`s3://${this.s3Bucket}/`, '');
        } else if (fileUrl.startsWith('http')) {
          const urlObj = new URL(fileUrl);
          s3Key = urlObj.pathname
            .replace(`/${this.s3Bucket}/`, '')
            .replace(/^\//, '');
        }

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
      } catch (err: any) {
        this.logger.error(`Failed to stream from S3: ${err.message}`);
        throw new NotFoundException(
          'Requested file not found in cloud storage',
        );
      }
    }

    // Local filesystem stream
    const relativePath = fileUrl.replace(/^\/uploads\//, '');
    const filePath = path.join(this.uploadDir, relativePath);

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
      try {
        let s3Key = fileUrl;
        if (fileUrl.startsWith('s3://')) {
          s3Key = fileUrl.replace(`s3://${this.s3Bucket}/`, '');
        } else if (fileUrl.startsWith('http')) {
          const urlObj = new URL(fileUrl);
          s3Key = urlObj.pathname
            .replace(`/${this.s3Bucket}/`, '')
            .replace(/^\//, '');
        }

        const command = new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
        });
        await this.s3Client.send(command);
        this.logger.log(`Deleted S3 object: ${s3Key}`);
        return;
      } catch (err: any) {
        this.logger.warn(`Failed to delete S3 object: ${err.message}`);
      }
    }

    const relativePath = fileUrl.replace(/^\/uploads\//, '');
    const filePath = path.join(this.uploadDir, relativePath);

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
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException('S3 driver is not configured for presigned uploads');
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
}
