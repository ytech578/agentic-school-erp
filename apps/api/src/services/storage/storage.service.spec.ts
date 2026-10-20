import { StorageService } from './storage.service';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

describe('StorageService - Multi-Provider Driver (Part 2)', () => {
  let service: StorageService;
  let mockConfig: { get: jest.Mock };
  const testUploadDir = path.join(__dirname, 'test_uploads');

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'STORAGE_LOCAL_PATH') return testUploadDir;
        return defaultVal;
      }),
    };

    service = new StorageService(mockConfig as unknown as ConfigService);
  });

  afterEach(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('uploads a file locally and returns a valid local URL', async () => {
    const fileBuffer = Buffer.from(
      '%PDF-1.7\nTest file content for storage service',
    );
    const result = await service.uploadFile(
      fileBuffer,
      'sample.pdf',
      'application/pdf',
      'documents',
    );

    expect(result.storageDriver).toBe('local');
    expect(result.url).toMatch(/^\/uploads\/documents\/\d+-/);
    expect(result.fileName).toMatch(/\.pdf$/);
    expect(result.fileSize).toBe(fileBuffer.length);
  });

  it('rejects a declared PDF whose bytes are not a PDF', async () => {
    await expect(
      service.uploadFile(
        Buffer.from('this is not a PDF'),
        'malicious.pdf',
        'application/pdf',
        'documents',
      ),
    ).rejects.toThrow('does not match its declared file type');
  });

  it('streams an uploaded local file successfully', async () => {
    const fileBuffer = Buffer.from('%PDF-1.7\nStreaming test content');
    const uploaded = await service.uploadFile(
      fileBuffer,
      'stream_test.pdf',
      'application/pdf',
      'documents',
    );

    const streamResult = await service.getFileStream(uploaded.url);
    expect(streamResult.fileName).toBe(uploaded.fileName);
    expect(streamResult.mimeType).toBe('application/pdf');
    expect(streamResult.fileSize).toBe(fileBuffer.length);
    expect(streamResult.stream).toBeDefined();

    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const retrievedBuffer = Buffer.concat(chunks);
    expect(retrievedBuffer.toString()).toBe('%PDF-1.7\nStreaming test content');
  });

  it('deletes a locally stored file without errors', async () => {
    const fileBuffer = Buffer.from('Deletable content');
    const result = await service.uploadFile(
      fileBuffer,
      'to_delete.txt',
      'text/plain',
      'temp',
    );

    await expect(service.deleteFile(result.url)).resolves.not.toThrow();
  });

  it('rejects traversal, absolute paths and sibling-directory prefix tricks', async () => {
    for (const locator of [
      '/uploads/../private.txt',
      '/uploads/../../test_uploads-other/private.txt',
      path.join(testUploadDir + '-other', 'private.txt'),
      '/uploads/a\\..\\private.txt',
      's3://unconfigured/key',
    ]) {
      await expect(service.getFileStream(locator)).rejects.toThrow();
      await expect(service.deleteFile(locator)).rejects.toThrow();
    }
    await expect(
      service.uploadFile(
        Buffer.from('safe'),
        'safe.txt',
        'text/plain',
        '../outside',
      ),
    ).rejects.toThrow('Invalid upload folder');
  });

  function cloudService() {
    const values: Record<string, string> = {
      STORAGE_DRIVER: 's3',
      S3_BUCKET_NAME: 'private-school',
      S3_ENDPOINT: 'https://storage.example.org',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'test-access',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      STORAGE_LOCAL_PATH: testUploadDir,
      S3_PUBLIC_BASE_URL: 'https://legacy.example.org/files',
    };
    const target = new StorageService({
      get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    } as unknown as ConfigService);
    const send = jest.spyOn(
      (target as unknown as { s3Client: { send: () => Promise<unknown> } })
        .s3Client,
      'send',
    );
    return { target, send };
  }

  it('persists private object locators even when a legacy public URL is configured', async () => {
    const { target, send } = cloudService();
    send.mockResolvedValue({});
    expect(
      (await target.uploadFile(Buffer.from('safe'), 'safe.txt', 'text/plain'))
        .url,
    ).toMatch(/^s3:\/\/private-school\/general\//);
  });

  it('never silently stores a failed cloud upload on the workstation', async () => {
    const { target, send } = cloudService();
    send.mockRejectedValue(new Error('Storage unavailable'));
    await expect(
      target.uploadFile(Buffer.from('safe'), 'safe.txt', 'text/plain'),
    ).rejects.toThrow('refusing local fallback');
    expect(fs.readdirSync(testUploadDir)).toEqual([]);
  });

  it('refuses another bucket or untrusted URL without contacting storage', async () => {
    const { target, send } = cloudService();
    await expect(
      target.deleteFile('s3://different-school/secret.pdf'),
    ).rejects.toThrow('different storage bucket');
    await expect(
      target.getFileStream('https://untrusted.example.org/secret.pdf'),
    ).rejects.toThrow('Untrusted');
    expect(send).not.toHaveBeenCalled();
  });
});
