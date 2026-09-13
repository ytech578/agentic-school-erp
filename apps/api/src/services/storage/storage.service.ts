import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageDriver: 'local' | 's3';
}

/**
 * Storage Service Abstraction
 * Supports:
 *  - Local filesystem (dev / default fallback)
 *  - AWS S3 / Cloudflare R2 / MinIO (cloud multi-instance production)
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly driver: 'local' | 's3';
  private readonly s3Bucket?: string;
  private readonly s3Endpoint?: string;
  private readonly s3PublicUrl?: string;

  constructor(private config: ConfigService) {
    this.driver = (this.config.get<string>('STORAGE_DRIVER', 'local').toLowerCase() as 'local' | 's3') || 'local';
    this.uploadDir = this.config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.s3Bucket = this.config.get<string>('S3_BUCKET_NAME');
    this.s3Endpoint = this.config.get<string>('S3_ENDPOINT');
    this.s3PublicUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');

    this.ensureUploadDir();
    this.logger.log(`StorageService initialized using [${this.driver.toUpperCase()}] driver`);
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'general',
  ): Promise<UploadResult> {
    const ext = path.extname(originalName);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;

    if (this.driver === 's3' && this.s3Bucket) {
      try {
        const s3Key = `${folder}/${fileName}`;
        // If live S3/MinIO endpoint is configured, perform REST PUT upload
        if (this.s3Endpoint) {
          const targetUrl = `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${s3Key}`;
          const res = await fetch(targetUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(buffer.length),
            },
            body: buffer as any,
          });
          if (res.ok) {
            const publicUrl = this.s3PublicUrl ? `${this.s3PublicUrl.replace(/\/$/, '')}/${s3Key}` : targetUrl;
            this.logger.log(`Uploaded to S3: ${publicUrl}`);
            return {
              url: publicUrl,
              fileName,
              fileSize: buffer.length,
              mimeType,
              storageDriver: 's3',
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`S3 upload failed, falling back to local storage: ${err.message}`);
      }
    }

    // Default Local Filesystem Driver
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

  async deleteFile(fileUrl: string): Promise<void> {
    if (fileUrl.startsWith('http') && this.driver === 's3' && this.s3Bucket && this.s3Endpoint) {
      try {
        const urlObj = new URL(fileUrl);
        const s3Key = urlObj.pathname.replace(`/${this.s3Bucket}/`, '').replace(/^\//, '');
        const targetUrl = `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${s3Key}`;
        await fetch(targetUrl, { method: 'DELETE' });
        this.logger.log(`Deleted S3 object: ${s3Key}`);
        return;
      } catch (err: any) {
        this.logger.warn(`Failed to delete S3 object: ${err.message}`);
      }
    }

    const relativePath = fileUrl.replace('/uploads/', '');
    const filePath = path.join(this.uploadDir, relativePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted locally: ${fileUrl}`);
    }
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}
