import { Test, TestingModule } from '@nestjs/testing';
import { AdmissionsService } from './admissions.service';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdmissionStatus, Gender } from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AdmissionsService', () => {
  let service: AdmissionsService;
  let mockPrisma: any;
  let mockNotifications: any;

  const SCHOOL_ID = 'school-tenant-123';

  beforeEach(async () => {
    mockPrisma = {
      admissionApplication: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      admissionEnquiry: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      student: {
        count: jest.fn(),
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
      guardian: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockNotifications = {
      sendEmail: jest.fn(),
      sendSMS: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdmissionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AdmissionsService>(AdmissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Multi-tenant isolation', () => {
    it('throws ForbiddenException when schoolId is empty or missing', async () => {
      await expect(service.findAllApplications('')).rejects.toThrow(ForbiddenException);
    });

    it('queries applications scoped by valid tenant schoolId', async () => {
      mockPrisma.admissionApplication.findMany.mockResolvedValue([]);
      await service.findAllApplications(SCHOOL_ID);

      expect(mockPrisma.admissionApplication.findMany).toHaveBeenCalledWith({
        where: { schoolId: SCHOOL_ID },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('convertApplicationToStudent', () => {
    const mockApp = {
      id: 'app-1',
      schoolId: SCHOOL_ID,
      applicationNo: 'APP-2026-001',
      studentName: 'Aarav Sharma',
      dateOfBirth: new Date('2015-05-15'),
      gender: Gender.MALE,
      religion: 'Hindu',
      category: 'General',
      classApplied: 'Grade 5',
      parentName: 'Ramesh Sharma',
      parentEmail: 'ramesh@example.com',
      parentPhone: '9876543210',
      address: '123 Main St',
      previousSchool: 'Old School',
      status: AdmissionStatus.ACCEPTED,
      convertedStudentId: null,
    };

    it('throws NotFoundException if application does not exist in school tenant', async () => {
      mockPrisma.admissionApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.convertApplicationToStudent(SCHOOL_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if application status is not ACCEPTED', async () => {
      mockPrisma.admissionApplication.findFirst.mockResolvedValue({
        ...mockApp,
        status: AdmissionStatus.SUBMITTED,
      });

      await expect(
        service.convertApplicationToStudent(SCHOOL_ID, 'app-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if application was already converted', async () => {
      mockPrisma.admissionApplication.findFirst.mockResolvedValue({
        ...mockApp,
        convertedStudentId: 'student-existing',
      });

      await expect(
        service.convertApplicationToStudent(SCHOOL_ID, 'app-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('hashes temporary password and creates student in transaction', async () => {
      mockPrisma.admissionApplication.findFirst.mockResolvedValue(mockApp);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-new-student', email: 'student_APP-2026-001@example.com' });
      mockPrisma.student.count.mockResolvedValue(10);
      mockPrisma.student.create.mockResolvedValue({ id: 'student-new-1', admissionNumber: 'ADM-2026-0011' });
      mockPrisma.guardian.create.mockResolvedValue({ id: 'guardian-1' });
      mockPrisma.admissionApplication.update.mockResolvedValue({
        ...mockApp,
        convertedStudentId: 'student-new-1',
      });

      const result = await service.convertApplicationToStudent(SCHOOL_ID, 'app-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'student_APP-2026-001@example.com',
          schoolId: SCHOOL_ID,
          role: 'STUDENT',
          passwordHash: expect.any(String),
        }),
      });

      const createdUserCall = mockPrisma.user.create.mock.calls[0][0];
      // Verify passwordHash is a valid bcrypt hash
      expect(createdUserCall.data.passwordHash).toMatch(/^\$2[aby]?\$\d+\$/);
      // Verify the returned temporary password matches the generated hash
      const isMatch = await bcrypt.compare(result.temporaryPassword, createdUserCall.data.passwordHash);
      expect(isMatch).toBe(true);

      expect(result.student.id).toBe('student-new-1');
      expect(result.temporaryPassword).toBeDefined();
    });
  });
});
