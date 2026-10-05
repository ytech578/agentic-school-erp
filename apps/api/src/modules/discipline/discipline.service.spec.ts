import { Test, TestingModule } from '@nestjs/testing';
import { DisciplineService } from './discipline.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IncidentSeverityEnum, IncidentStatusEnum } from './dto/discipline.dto';

describe('DisciplineService', () => {
  let service: DisciplineService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';
  const mockStaffUserId = 'teacher-user-01';
  const mockStaffId = 'staff-01';
  const mockStudentId = 'student-01';

  beforeEach(async () => {
    prisma = {
      staff: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
      disciplineIncident: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisciplineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DisciplineService>(DisciplineService);
  });

  describe('createIncident', () => {
    it('should throw BadRequestException if reporting staff is not found in school', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createIncident(mockSchoolId, mockStaffUserId, {
          studentId: mockStudentId,
          title: 'Class disruption',
          description: 'Refused to follow teacher instructions',
          category: 'DISRESPECT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-provision a staff profile when user is an admin without a staff record', async () => {
      prisma.staff.findFirst.mockResolvedValueOnce(null);
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'admin-user-01',
        role: 'SCHOOL_ADMIN',
        schoolId: mockSchoolId,
      });
      prisma.staff.findUnique.mockResolvedValueOnce(null);
      prisma.staff.count.mockResolvedValueOnce(0);
      prisma.staff.create.mockResolvedValueOnce({
        id: 'staff-auto-1',
        userId: 'admin-user-01',
        schoolId: mockSchoolId,
        employeeId: 'ADM0001',
        isActive: true,
      });
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        firstName: 'Aarav',
        guardians: [],
      });
      prisma.disciplineIncident.count.mockResolvedValue(0);
      prisma.disciplineIncident.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'inc-auto-1', ...data }),
      );

      const res = await service.createIncident(mockSchoolId, 'admin-user-01', {
        studentId: mockStudentId,
        title: 'Vandalism incident',
        description: 'Damaged classroom equipment',
        category: 'VANDALISM',
      });

      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: mockSchoolId,
            userId: 'admin-user-01',
            employeeId: 'ADM0001',
          }),
        }),
      );
      expect(res.incidentNumber).toBe(`DISC/${new Date().getFullYear()}/0001`);
    });

    it('should create incident and notify parent if requested', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        userId: mockStaffUserId,
      });
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        firstName: 'Rohan',
        guardians: [{ userId: 'parent-uid-1' }],
      });
      prisma.disciplineIncident.count.mockResolvedValue(0);
      prisma.disciplineIncident.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'inc-1', ...data }),
      );

      const res = await service.createIncident(mockSchoolId, mockStaffUserId, {
        studentId: mockStudentId,
        title: 'Class disruption',
        description: 'Refused to follow teacher instructions',
        category: 'DISRESPECT',
        severity: IncidentSeverityEnum.MODERATE,
        notifyParent: true,
      });

      expect(res.incidentNumber).toBe(`DISC/${new Date().getFullYear()}/0001`);
      expect(res.parentNotified).toBe(true);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'parent-uid-1',
            title: expect.stringContaining('Disciplinary Notice'),
          }),
        }),
      );
    });

    it('should auto-generate fallback title from category when title is omitted or blank', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        userId: mockStaffUserId,
      });
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        firstName: 'Kabir',
        guardians: [],
      });
      prisma.disciplineIncident.count.mockResolvedValue(2);
      let createdPayload: any = null;
      prisma.disciplineIncident.create.mockImplementation(({ data }: { data: any }) => {
        createdPayload = data;
        return Promise.resolve({ id: 'inc-2', ...data });
      });

      const res = await service.createIncident(mockSchoolId, mockStaffUserId, {
        studentId: mockStudentId,
        description: 'Bullying classmate during recess',
        category: 'BULLYING_HARASSMENT',
        severity: IncidentSeverityEnum.MAJOR,
      });

      expect(createdPayload.title).toBe('BULLYING HARASSMENT Incident');
      expect(res.title).toBe('BULLYING HARASSMENT Incident');
    });
  });

  describe('getIncidents', () => {
    it('should exclude confidential incidents for non-elevated teachers who did not report them', async () => {
      prisma.disciplineIncident.findMany.mockResolvedValue([]);

      await service.getIncidents(mockSchoolId, 'teacher-user-2', 'TEACHER');

      expect(prisma.disciplineIncident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: mockSchoolId,
            OR: [
              { isConfidential: false },
              { reportedByStaff: { userId: 'teacher-user-2' } },
            ],
          }),
        }),
      );
    });

    it('should allow SCHOOL_ADMIN to view all incidents without confidentiality filter', async () => {
      prisma.disciplineIncident.findMany.mockResolvedValue([]);

      await service.getIncidents(mockSchoolId, 'admin-user', 'SCHOOL_ADMIN');

      expect(prisma.disciplineIncident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId: mockSchoolId },
        }),
      );
    });
  });

  describe('getIncidentById', () => {
    it('should throw ForbiddenException if incident is confidential and viewer is not authorized', async () => {
      prisma.disciplineIncident.findFirst.mockResolvedValue({
        id: 'inc-confidential',
        schoolId: mockSchoolId,
        isConfidential: true,
        student: { userId: 'student-uid', guardians: [] },
        reportedByStaff: { userId: 'different-staff-uid' },
      });

      await expect(
        service.getIncidentById(
          mockSchoolId,
          'inc-confidential',
          'intruder-teacher',
          'TEACHER',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateIncidentStatus', () => {
    it('should update status and record resolvedAt when RESOLVED', async () => {
      prisma.disciplineIncident.findFirst.mockResolvedValue({
        id: 'inc-1',
        schoolId: mockSchoolId,
        actionTaken: 'Initial warning',
      });
      prisma.disciplineIncident.update.mockResolvedValue({
        id: 'inc-1',
        status: 'RESOLVED',
        resolvedAt: new Date(),
      });

      const res = await service.updateIncidentStatus(mockSchoolId, 'inc-1', {
        status: IncidentStatusEnum.RESOLVED,
        resolutionNotes:
          'Student apologized and agreed to detention remediation.',
      });

      expect(res.status).toBe('RESOLVED');
      expect(prisma.disciplineIncident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inc-1' },
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolvedAt: expect.any(Date),
            resolutionNotes:
              'Student apologized and agreed to detention remediation.',
          }),
        }),
      );
    });

    it('should support resolution alias and map IN_PROGRESS to INVESTIGATING', async () => {
      prisma.disciplineIncident.findFirst.mockResolvedValue({
        id: 'inc-2',
        schoolId: mockSchoolId,
        actionTaken: null,
      });
      prisma.disciplineIncident.update.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'inc-2', ...data }),
      );

      const res = await service.updateIncidentStatus(mockSchoolId, 'inc-2', {
        status: IncidentStatusEnum.IN_PROGRESS,
        resolution: 'Counseling ongoing',
      });

      expect(res.status).toBe('INVESTIGATING');
      expect(res.resolutionNotes).toBe('Counseling ongoing');
      expect(res.resolvedAt).toBeNull();
    });
  });

  describe('notifyParent', () => {
    it('should dispatch alert notification to guardians using message or customMessage', async () => {
      prisma.disciplineIncident.findFirst.mockResolvedValue({
        id: 'inc-3',
        schoolId: mockSchoolId,
        incidentNumber: 'DISC/2026/0003',
        title: 'Class disturbance',
        severity: 'MODERATE',
        actionTaken: 'Verbal warning',
        student: {
          user: { firstName: 'Rohan', lastName: 'Sharma' },
          guardians: [{ userId: 'parent-uid-10' }],
        },
      });
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
      prisma.disciplineIncident.update.mockResolvedValue({
        id: 'inc-3',
        parentNotified: true,
      });

      const res = await service.notifyParent(mockSchoolId, 'inc-3', {
        message: 'Student was disruptive during science class.',
      });

      expect(res.parentNotified).toBe(true);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'parent-uid-10',
            message: 'Student was disruptive during science class.',
          }),
        }),
      );
    });
  });
});
