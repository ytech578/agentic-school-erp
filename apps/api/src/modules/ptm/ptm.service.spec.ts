import { Test, TestingModule } from '@nestjs/testing';
import { PtmService } from './ptm.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PtmModeEnum } from './dto/ptm.dto';

describe('PtmService', () => {
  let service: PtmService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';
  const mockTeacherId = 'teacher-01';
  const mockStudentId = 'student-01';
  const mockParentUserId = 'parent-user-01';

  beforeEach(async () => {
    prisma = {
      staff: {
        findMany: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
      ptmSession: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      ptmSlot: {
        createMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PtmService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PtmService>(PtmService);
  });

  describe('createSession', () => {
    it('should throw BadRequestException if startTime >= endTime', async () => {
      await expect(
        service.createSession(mockSchoolId, {
          title: 'PTM 1',
          date: '2026-09-30',
          startTime: '12:00',
          endTime: '09:00',
          teacherIds: [mockTeacherId],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create session and generate slots for each participating teacher', async () => {
      prisma.staff.findMany.mockResolvedValue([
        { id: mockTeacherId, schoolId: mockSchoolId, isActive: true },
      ]);
      prisma.ptmSession.create.mockResolvedValue({
        id: 'session-1',
        title: 'Midterm PTM',
      });

      const res = await service.createSession(mockSchoolId, {
        title: 'Midterm PTM',
        date: '2026-09-30',
        startTime: '09:00',
        endTime: '10:00',
        slotDuration: 15,
        teacherIds: [mockTeacherId],
      });

      expect(res.id).toBe('session-1');
      // 09:00 to 10:00 with 15-min slots = 4 slots: 09:00-09:15, 09:15-09:30, 09:30-09:45, 09:45-10:00
      expect(prisma.ptmSlot.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ startTime: '09:00', endTime: '09:15' }),
          expect.objectContaining({ startTime: '09:15', endTime: '09:30' }),
          expect.objectContaining({ startTime: '09:30', endTime: '09:45' }),
          expect.objectContaining({ startTime: '09:45', endTime: '10:00' }),
        ]),
      });
    });
  });

  describe('bookSlot', () => {
    it('should throw ForbiddenException if user is not guardian of student', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        guardians: [{ userId: 'another-parent-user' }],
      });

      await expect(
        service.bookSlot(mockSchoolId, 'slot-1', 'stranger-user', 'PARENT', {
          studentId: mockStudentId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if slot is already booked', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        guardians: [{ userId: mockParentUserId }],
      });
      prisma.ptmSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        status: 'BOOKED',
      });

      await expect(
        service.bookSlot(mockSchoolId, 'slot-1', mockParentUserId, 'PARENT', {
          studentId: mockStudentId,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should book available slot successfully', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: mockStudentId,
        guardians: [{ userId: mockParentUserId }],
      });
      prisma.ptmSlot.findFirst
        .mockResolvedValueOnce({
          id: 'slot-1',
          sessionId: 'session-1',
          teacherId: mockTeacherId,
          status: 'AVAILABLE',
        })
        .mockResolvedValueOnce(null); // No existing booking for this student

      prisma.ptmSlot.update.mockResolvedValue({
        id: 'slot-1',
        status: 'BOOKED',
        studentId: mockStudentId,
        parentId: mockParentUserId,
      });

      const res = await service.bookSlot(
        mockSchoolId,
        'slot-1',
        mockParentUserId,
        'PARENT',
        { studentId: mockStudentId, parentNotes: 'Discuss math progress' },
      );

      expect(res.status).toBe('BOOKED');
      expect(prisma.ptmSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'slot-1' },
          data: expect.objectContaining({
            status: 'BOOKED',
            studentId: mockStudentId,
            parentId: mockParentUserId,
            parentNotes: 'Discuss math progress',
          }),
        }),
      );
    });
  });

  describe('cancelBooking', () => {
    it('should revert slot to AVAILABLE', async () => {
      prisma.ptmSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        status: 'BOOKED',
        parentId: mockParentUserId,
      });
      prisma.ptmSlot.update.mockResolvedValue({
        id: 'slot-1',
        status: 'AVAILABLE',
      });

      const res = await service.cancelBooking(
        mockSchoolId,
        'slot-1',
        mockParentUserId,
        'PARENT',
      );

      expect(res.status).toBe('AVAILABLE');
      expect(prisma.ptmSlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: {
          status: 'AVAILABLE',
          studentId: null,
          parentId: null,
          parentNotes: null,
        },
      });
    });
  });

  describe('completeSlot', () => {
    it('should record teacher feedback and mark COMPLETED', async () => {
      prisma.ptmSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        teacher: { userId: 'teacher-user-1' },
      });
      prisma.ptmSlot.update.mockResolvedValue({
        id: 'slot-1',
        status: 'COMPLETED',
      });

      const res = await service.completeSlot(
        mockSchoolId,
        'slot-1',
        'teacher-user-1',
        'TEACHER',
        {
          teacherNotes: 'Student is attentive; needs more algebra practice.',
          actionItems: 'Daily 20 mins homework revision.',
        },
      );

      expect(res.status).toBe('COMPLETED');
      expect(prisma.ptmSlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: {
          status: 'COMPLETED',
          teacherNotes: 'Student is attentive; needs more algebra practice.',
          actionItems: 'Daily 20 mins homework revision.',
        },
      });
    });
  });
});
