import { Readable } from 'node:stream';
import { DocumentSecurityController } from './document-security.controller';
import type { AuthenticatedRequest } from '../../core/types/auth-request.interface';

describe('Document quarantine and retention policy', () => {
  const request = {
    user: { id: 'admin', schoolId: 'school' },
  } as AuthenticatedRequest;
  const reason = 'Security review of the retained document';
  function setup() {
    const document = {
      id: 'doc',
      fileUrl: 'private-url',
      sha256: 'original',
      retainedUntil: new Date(Date.now() + 86_400_000 * 100),
      legalHold: false,
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'doc' }]),
      studentDocument: {
        findFirst: jest.fn().mockResolvedValue(document),
        update: jest.fn(({ data }) =>
          Promise.resolve({ ...document, ...data }),
        ),
      },
    };
    const db = {
      ...tx,
      $transaction: jest.fn((work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const scanner = {
      scan: jest.fn().mockResolvedValue({
        status: 'CLEAN',
        sha256: 'original',
        engine: 'clamav',
        details: {},
      }),
    };
    const storage = {
      getFileStream: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ stream: Readable.from([Buffer.from('safe')]) }),
        ),
    };
    const audit = { recordMutation: jest.fn() };
    return {
      controller: new DocumentSecurityController(
        db as never,
        scanner as never,
        storage as never,
        audit as never,
      ),
      tx,
      audit,
      scanner,
    };
  }

  it('rejects shortening the existing retention period', async () => {
    const { controller, tx } = setup();
    await expect(
      controller.policy(request, 'student', 'doc', {
        retainedUntil: new Date(Date.now() + 86_400_000).toISOString(),
        reason,
      }),
    ).rejects.toThrow('only be extended');
    expect(tx.studentDocument.update).not.toHaveBeenCalled();
  });

  it('does not change another school document', async () => {
    const { controller, tx } = setup();
    tx.studentDocument.findFirst.mockResolvedValue(null);
    await expect(
      controller.policy(request, 'student', 'doc', { legalHold: true, reason }),
    ).rejects.toThrow('not found');
    expect(tx.studentDocument.update).not.toHaveBeenCalled();
  });

  it('locks the document and audits a legal hold in the same transaction', async () => {
    const { controller, tx, audit } = setup();
    await controller.policy(request, 'student', 'doc', {
      legalHold: true,
      reason,
    });
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'doc',
    );
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ legalHold: false }) as unknown,
        after: expect.objectContaining({ legalHold: true }) as unknown,
      }),
      tx,
    );
  });

  it('keeps a clean-scanned document quarantined if its checksum changed', async () => {
    const { controller, tx, scanner } = setup();
    scanner.scan.mockResolvedValue({
      status: 'CLEAN',
      sha256: 'changed',
      engine: 'clamav',
      details: {},
    });
    await controller.rescan(request, 'student', 'doc', { reason });
    expect(tx.studentDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scanStatus: 'QUARANTINED',
          quarantineReason: 'Stored document checksum changed',
        }) as unknown,
      }),
    );
  });

  it('releases quarantine only after a clean verdict and matching checksum', async () => {
    const { controller, tx } = setup();
    await controller.rescan(request, 'student', 'doc', { reason });
    expect(tx.studentDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scanStatus: 'CLEAN',
          quarantineReason: null,
        }) as unknown,
      }),
    );
  });
});
