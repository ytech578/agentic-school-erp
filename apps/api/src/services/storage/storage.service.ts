import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Storage Service Abstraction
 * MVP: Local filesystem
 * Future: Swap to S3/Azure/GCS without changing callers
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private config: ConfigService) {
    this.uploadDir = this.config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.ensureUploadDir();
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'general',
  ): Promise<UploadResult> {
    const ext = path.extname(originalName);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;
    const folderPath = path.join(this.uploadDir, folder);
    const filePath = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${folder}/${fileName}`;
    this.logger.log(`File uploaded: ${url}`);

    return {
      url,
      fileName,
      fileSize: buffer.length,
      mimeType,
    };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const relativePath = fileUrl.replace('/uploads/', '');
    const filePath = path.join(this.uploadDir, relativePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted: ${fileUrl}`);
    }
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}
