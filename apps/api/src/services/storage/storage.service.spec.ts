import { StorageService } from './storage.service';
import * as fs from 'fs';
import * as path from 'path';

describe('StorageService - Multi-Provider Driver (Part 2)', () => {
  let service: StorageService;
  let mockConfig: any;
  const testUploadDir = path.join(__dirname, 'test_uploads');

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'STORAGE_LOCAL_PATH') return testUploadDir;
        return defaultVal;
      }),
    };

    service = new StorageService(mockConfig);
  });

  afterEach(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('uploads a file locally and returns a valid local URL', async () => {
    const fileBuffer = Buffer.from('Test file content for storage service');
    const result = await service.uploadFile(fileBuffer, 'sample.pdf', 'application/pdf', 'documents');

    expect(result.storageDriver).toBe('local');
    expect(result.url).toMatch(/^\/uploads\/documents\/\d+-/);
    expect(result.fileName).toMatch(/\.pdf$/);
    expect(result.fileSize).toBe(fileBuffer.length);
  });

  it('deletes a locally stored file without errors', async () => {
    const fileBuffer = Buffer.from('Deletable content');
    const result = await service.uploadFile(fileBuffer, 'to_delete.txt', 'text/plain', 'temp');

    await expect(service.deleteFile(result.url)).resolves.not.toThrow();
  });
});
