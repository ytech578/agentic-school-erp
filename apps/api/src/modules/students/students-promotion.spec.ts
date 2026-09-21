import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StudentsService - Promotion & Status Lifecycle', () => {
  let service: StudentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      student: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      studentEnrollment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'enr-new', status: 'ACTIVE' }),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      studentPromotion: {
        create: jest.fn().mockResolvedValue({ id: 'promo-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  describe('promoteStudents', () => {
    it('throws BadRequestException if no students are selected', async () => {
      await expect(
        service.promoteStudents('school-1', 'admin-1', {
          fromSectionId: 'sec-9a',
          toSectionId: 'sec-10a',
          studentIds: [],
          academicYearId: 'ay-2027',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('promotes batch of students to target section and logs promotion records', async () => {
      const result = await service.promoteStudents('school-1', 'admin-1', {
        fromSectionId: 'sec-9a',
        toSectionId: 'sec-10a',
        studentIds: ['std-1', 'std-2'],
        academicYearId: 'ay-2027',
        remarks: 'Annual CBSE Final Exam Promotion',
      });

      expect(result.success).toBe(true);
      expect(result.promotedCount).toBe(2);
      expect(result.status).toBe('PROMOTED');

      // Previous enrollments closed
      expect(prisma.studentEnrollment.updateMany).toHaveBeenCalledWith({
        where: {
          studentId: 'std-1',
          sectionId: 'sec-9a',
          status: 'ACTIVE',
        },
        data: expect.objectContaining({ status: 'PROMOTED' }),
      });

      // New enrollments created
      expect(prisma.studentEnrollment.upsert).toHaveBeenCalledWith({
        where: {
          studentId_sectionId: {
            studentId: 'std-1',
            sectionId: 'sec-10a',
          },
        },
        create: expect.objectContaining({
          studentId: 'std-1',
          sectionId: 'sec-10a',
          status: 'ACTIVE',
        }),
        update: expect.objectContaining({
          status: 'ACTIVE',
          leftAt: null,
        }),
      });

      // Promotion log inserted
      expect(prisma.studentPromotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          schoolId: 'school-1',
          studentId: 'std-1',
          academicYearId: 'ay-2027',
          fromSectionId: 'sec-9a',
          toSectionId: 'sec-10a',
          promotedById: 'admin-1',
        }),
      });
    });

    it('supports GRADUATED status when no toSectionId is specified (final year graduation)', async () => {
      const result = await service.promoteStudents('school-1', 'admin-1', {
        fromSectionId: 'sec-12a',
        studentIds: ['std-senior'],
        academicYearId: 'ay-2026',
        status: 'GRADUATED',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('GRADUATED');
      expect(prisma.studentEnrollment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updateStudentStatus', () => {
    it('throws NotFoundException if student does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStudentStatus('school-1', 'invalid-id', {
          isActive: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deactivates student and sets User status to INACTIVE', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId: 'school-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.student.update.mockResolvedValue({ id: 'std-1', isActive: false });

      const res = await service.updateStudentStatus('school-1', 'std-1', {
        isActive: false,
        status: 'TRANSFERRED',
        reason: 'Relocated to another city',
      });

      expect(res.isActive).toBe(false);
      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'std-1' },
        data: { isActive: false },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'INACTIVE' },
      });
      expect(prisma.studentEnrollment.updateMany).toHaveBeenCalledWith({
        where: { studentId: 'std-1', status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'TRANSFERRED' }),
      });
    });

    it('reactivates inactive student', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId: 'school-1',
        userId: 'user-1',
        isActive: false,
      });
      prisma.student.update.mockResolvedValue({ id: 'std-1', isActive: true });
      prisma.studentEnrollment.findFirst.mockResolvedValue({ id: 'enr-old' });

      const res = await service.updateStudentStatus('school-1', 'std-1', {
        isActive: true,
      });

      expect(res.isActive).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE' },
      });
    });
  });
});
