import { Test, TestingModule } from '@nestjs/testing';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from '../../services/storage/storage.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CertificateTypeEnum } from './dto/certificate.dto';

describe('CertificatesService', () => {
  let service: CertificatesService;
  let prisma: jest.Mocked<any>;
  let storage: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';
  const mockStudentId = 'student-001';

  beforeEach(async () => {
    prisma = {
      certificateTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
      },
      issuedCertificate: {
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    storage = {
      saveFile: jest
        .fn()
        .mockResolvedValue('schools/school-delhi-01/certificates/test.pdf'),
      getFileStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
  });

  describe('issueCertificate', () => {
    it('should throw NotFoundException if student does not belong to school', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      prisma.school.findUnique.mockResolvedValue({
        id: mockSchoolId,
        name: 'Delhi Public School',
      });

      await expect(
        service.issueCertificate(mockSchoolId, 'admin-user', {
          studentId: mockStudentId,
          type: CertificateTypeEnum.TRANSFER_CERTIFICATE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate TC with verification hash and PDF upload', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        firstName: 'Aarav',
        lastName: 'Sharma',
        admissionNumber: 'DPS/2026/0142',
        dateOfBirth: new Date('2010-05-15'),
        guardians: [
          { firstName: 'Sunil', lastName: 'Sharma', relationship: 'father' },
          { firstName: 'Pooja', lastName: 'Sharma', relationship: 'mother' },
        ],
        enrollments: [
          {
            status: 'ACTIVE',
            class: { name: 'Class 10' },
            section: { name: 'A' },
          },
        ],
      });

      prisma.school.findUnique.mockResolvedValue({
        id: mockSchoolId,
        name: 'Delhi Public School',
        city: 'New Delhi',
        boardType: 'CBSE',
      });

      prisma.issuedCertificate.count.mockResolvedValue(4);
      prisma.issuedCertificate.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'cert-1', ...data }),
      );

      const res = await service.issueCertificate(mockSchoolId, 'admin-user', {
        studentId: mockStudentId,
        type: CertificateTypeEnum.TRANSFER_CERTIFICATE,
        reason: 'Transfer of father to Bengaluru',
      });

      expect(res.certificateNumber).toBe('TC/2026/0005');
      expect(res.verificationHash).toBeDefined();
      expect(res.verificationHash.length).toBe(64); // SHA-256 hex string
      expect(storage.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('schools/school-delhi-01/certificates/'),
        expect.any(Buffer),
        'application/pdf',
      );
      expect(prisma.issuedCertificate.create).toHaveBeenCalled();
    });
  });

  describe('verifyCertificateByHash', () => {
    it('should return verified details for valid hash', async () => {
      prisma.issuedCertificate.findUnique.mockResolvedValue({
        id: 'cert-1',
        schoolId: mockSchoolId,
        certificateNumber: 'TC/2026/0005',
        type: 'TRANSFER_CERTIFICATE',
        issueDate: new Date('2026-09-01'),
        conductRemark: 'Exemplary',
        isRevoked: false,
        verificationHash: 'valid-sha-hash',
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          admissionNumber: 'DPS/0142',
        },
      });

      prisma.school.findUnique.mockResolvedValue({
        id: mockSchoolId,
        name: 'Delhi Public School',
        city: 'New Delhi',
      });

      const res = await service.verifyCertificateByHash('valid-sha-hash');

      expect(res.isValid).toBe(true);
      expect(res.isRevoked).toBe(false);
      expect(res.studentName).toBe('Aarav Sharma');
      expect(res.schoolName).toBe('Delhi Public School');
    });

    it('should report isRevoked: true if certificate was marked revoked', async () => {
      prisma.issuedCertificate.findUnique.mockResolvedValue({
        id: 'cert-1',
        schoolId: mockSchoolId,
        certificateNumber: 'TC/2026/0005',
        type: 'TRANSFER_CERTIFICATE',
        issueDate: new Date('2026-09-01'),
        conductRemark: 'Exemplary',
        isRevoked: true,
        verificationHash: 'revoked-hash',
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          admissionNumber: 'DPS/0142',
        },
      });

      const res = await service.verifyCertificateByHash('revoked-hash');
      expect(res.isValid).toBe(false);
      expect(res.isRevoked).toBe(true);
    });

    it('should throw NotFoundException if hash not found', async () => {
      prisma.issuedCertificate.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyCertificateByHash('fake-hash'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudentCertificates', () => {
    it('should permit student user to view their own certificates', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        userId: 'student-user-1',
        guardians: [],
      });
      prisma.issuedCertificate.findMany.mockResolvedValue([{ id: 'c1' }]);

      const res = await service.getStudentCertificates(
        mockSchoolId,
        mockStudentId,
        'student-user-1',
        'STUDENT',
      );
      expect(res.length).toBe(1);
    });

    it('should deny unauthorized user from accessing student certificates', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        userId: 'student-user-1',
        guardians: [{ userId: 'parent-user-1' }],
      });

      await expect(
        service.getStudentCertificates(
          mockSchoolId,
          mockStudentId,
          'stranger-user-3',
          'STUDENT',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeCertificate', () => {
    it('should mark certificate revoked with reason', async () => {
      prisma.issuedCertificate.findFirst.mockResolvedValue({
        id: 'cert-1',
        schoolId: mockSchoolId,
        remarks: 'Initial remark',
      });
      prisma.issuedCertificate.update.mockResolvedValue({
        id: 'cert-1',
        isRevoked: true,
      });

      await service.revokeCertificate(mockSchoolId, 'cert-1', {
        reason: 'Issued with incorrect birth date by clerk error',
      });

      expect(prisma.issuedCertificate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cert-1' },
          data: expect.objectContaining({
            isRevoked: true,
            remarks: expect.stringContaining(
              'REVOKED: Issued with incorrect birth date',
            ),
          }),
        }),
      );
    });
  });
});
