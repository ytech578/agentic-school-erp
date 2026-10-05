import { Test, TestingModule } from '@nestjs/testing';
import { DpdpService } from './dpdp.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { StorageService } from '../../services/storage/storage.service';

describe('DpdpService', () => {
  let service: DpdpService;
  let prisma: jest.Mocked<any>;
  let storage: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';
  const mockStudentId = 'student-01';
  const mockGuardianUserId = 'guardian-user-01';

  beforeEach(async () => {
    storage = {
      uploadFile: jest.fn().mockResolvedValue({ url: 'https://storage.local/file.zip' }),
      getFileStream: jest.fn(),
    };

    prisma = {
      student: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      guardian: {
        updateMany: jest.fn(),
      },
      activityLog: {
        findMany: jest.fn(),
      },
      dataConsent: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      dataPrivacyRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DpdpService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<DpdpService>(DpdpService);
  });

  describe('grantOrRevokeConsent', () => {
    it('should throw ForbiddenException if user is not verified guardian of student', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        guardians: [{ id: 'g-1', userId: 'different-parent-user' }],
      });

      await expect(
        service.grantOrRevokeConsent(
          mockSchoolId,
          'stranger-user',
          '127.0.0.1',
          {
            studentId: mockStudentId,
            consentType: 'ACADEMIC_RECORDS',
            isGranted: true,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upsert parental consent successfully', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        guardians: [{ id: 'g-1', userId: mockGuardianUserId }],
      });
      prisma.dataConsent.upsert.mockResolvedValue({
        id: 'consent-1',
        isGranted: true,
        consentType: 'BIOMETRIC_ATTENDANCE',
      });

      const res = await service.grantOrRevokeConsent(
        mockSchoolId,
        mockGuardianUserId,
        '192.168.1.100',
        {
          studentId: mockStudentId,
          consentType: 'BIOMETRIC_ATTENDANCE',
          isGranted: true,
        },
      );

      expect(res.isGranted).toBe(true);
      expect(prisma.dataConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId_consentType: {
              studentId: mockStudentId,
              consentType: 'BIOMETRIC_ATTENDANCE',
            },
          },
        }),
      );
    });
  });

  describe('exportUserData', () => {
    it('should export structured JSON archive with academic and privacy metadata', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'student-user-1',
        email: 'student@dps.edu',
        firstName: 'Vivaan',
        lastName: 'Patel',
        role: 'STUDENT',
      });

      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        admissionNumber: 'DPS/2026/089',
        gender: 'MALE',
        bloodGroup: 'O_POSITIVE',
        guardians: [{ firstName: 'Sanjay', lastName: 'Patel' }],
        enrollments: [],
        attendanceRecords: [],
        studentMarks: [],
        feePayments: [],
        dataConsents: [],
      });

      prisma.activityLog.findMany.mockResolvedValue([]);

      const res = await service.exportUserData(mockSchoolId, 'student-user-1');

      expect(res.exportMetadata.act).toContain('DPDP Act');
      expect(res.userProfile.email).toBe('student@dps.edu');
      expect(res.academicRecord?.studentProfile.admissionNumber).toBe(
        'DPS/2026/089',
      );
    });
  });

  describe('anonymizeUserData', () => {
    it('should anonymize User and Student PII under Section 12', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-to-erase',
        email: 'privacy@request.com',
      });
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-to-erase',
      });

      const res = await service.anonymizeUserData(
        mockSchoolId,
        'user-to-erase',
        'Parent requested right to erasure',
      );

      expect(res.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-to-erase' },
          data: expect.objectContaining({
            firstName: 'Anonymized',
            lastName: 'User',
            status: 'SUSPENDED',
          }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-to-erase' },
          data: expect.objectContaining({
            aadhaarNumber: null,
            address: null,
            isActive: false,
          }),
        }),
      );
    });
  });
});
