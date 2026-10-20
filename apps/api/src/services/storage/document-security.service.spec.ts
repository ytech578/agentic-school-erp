import { DocumentSecurityService } from './document-security.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from './storage.service';

describe('DocumentSecurityService', () => {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'app.nodeEnv') return 'test';
      return fallback;
    }),
  } as unknown as ConfigService;
  const prisma = {} as unknown as PrismaService;
  const storage = {} as unknown as StorageService;
  const service = new DocumentSecurityService(config, prisma, storage);

  it('quarantines the EICAR test signature before calling an external scanner', async () => {
    const result = await service.scan(
      Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      ),
    );
    expect(result.status).toBe('INFECTED');
    expect(result.engine).toBe('built-in-eicar');
    expect(result.sha256).toHaveLength(64);
  });

  it('uses the development signature gate when ClamAV is optional', async () => {
    const result = await service.scan(Buffer.from('safe document'));
    expect(result.status).toBe('CLEAN');
    expect(result.engine).toBe('development-signature-gate');
  });

  it('quarantines a scanner error response instead of treating it as clean', async () => {
    const liveConfig = {
      get: (key: string, fallback?: unknown) =>
        key === 'CLAMAV_HOST' ? 'scanner' : fallback,
    } as ConfigService;
    const target = new DocumentSecurityService(liveConfig, prisma, storage);
    const scanner = target as unknown as {
      scanWithClamAv: () => Promise<string>;
    };
    jest
      .spyOn(scanner, 'scanWithClamAv')
      .mockResolvedValue('INSTREAM size limit exceeded. ERROR');
    const result = await target.scan(Buffer.from('test'));
    expect(result.status).toBe('ERROR');
  });

  it('fails closed when a required scanner returns an unknown response', async () => {
    const liveConfig = {
      get: (key: string, fallback?: unknown) =>
        key === 'CLAMAV_HOST'
          ? 'scanner'
          : key === 'app.nodeEnv'
            ? 'production'
            : fallback,
    } as ConfigService;
    const target = new DocumentSecurityService(liveConfig, prisma, storage);
    jest
      .spyOn(
        target as unknown as { scanWithClamAv: () => Promise<string> },
        'scanWithClamAv',
      )
      .mockResolvedValue('UNKNOWN');
    await expect(target.scan(Buffer.from('test'))).rejects.toThrow(
      'Malware scanner unavailable',
    );
  });

  function retentionService(
    eligible: Array<{ id: string; fileUrl: string }>,
    fails = false,
  ) {
    const update = jest.fn().mockResolvedValue({});
    const database = {
      runAsSystem: jest.fn((work: () => Promise<unknown>) => work()),
      studentDocument: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'doc', fileUrl: 'stale-url' }]),
        update,
      },
      admissionDocument: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn().mockResolvedValue(eligible),
    };
    const deleteFile = fails
      ? jest.fn().mockRejectedValue(new Error('Storage unavailable'))
      : jest.fn().mockResolvedValue(undefined);
    return {
      target: new DocumentSecurityService(
        config,
        database as unknown as PrismaService,
        { deleteFile } as unknown as StorageService,
      ),
      update,
      deleteFile,
      database,
    };
  }

  it('does not purge a document whose hold changed after the initial selection', async () => {
    const { target, update, deleteFile } = retentionService([]);
    expect(await target.enforceRetention()).toEqual({ purged: 0 });
    expect(deleteFile).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the document eligible for retry when storage deletion fails', async () => {
    const { target, update } = retentionService(
      [{ id: 'doc', fileUrl: 'current-url' }],
      true,
    );
    expect(await target.enforceRetention()).toEqual({ purged: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it('uses the locked current object URL before marking retention deletion', async () => {
    const { target, update, deleteFile, database } = retentionService([
      { id: 'doc', fileUrl: 'current-url' },
    ]);
    expect(await target.enforceRetention()).toEqual({ purged: 1 });
    expect(database.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      'doc',
    );
    expect(deleteFile).toHaveBeenCalledWith('current-url');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'doc' },
      data: { deletedAt: expect.any(Date) as Date },
    });
  });
});
