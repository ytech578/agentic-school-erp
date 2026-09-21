import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let prisma: {
    assignment: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    assignmentSubmission: { findMany: jest.Mock; upsert: jest.Mock };
    studentEnrollment: { findMany: jest.Mock };
    student: { findFirst: jest.Mock };
    academicYear: { findFirst: jest.Mock };
    class: { findFirst: jest.Mock };
    section: { findFirst: jest.Mock };
    subject: { findFirst: jest.Mock };
    staff: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      assignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      assignmentSubmission: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      studentEnrollment: {
        findMany: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
      },
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
      },
      subject: {
        findFirst: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('getSubmissions', () => {
    const schoolId = 'school-123';
    const assignmentId = 'cmttsw9ah05y55br5fk1y1hli';

    it('should throw NotFoundException if assignment does not exist', async () => {
      prisma.assignment.findFirst.mockResolvedValue(null);

      await expect(
        service.getSubmissions(schoolId, assignmentId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.assignment.findFirst).toHaveBeenCalledWith({
        where: { id: assignmentId, schoolId },
        include: { class: true, section: true, subject: true },
      });
    });

    it('should query section.classId when sectionId is null (Class-level assignment)', async () => {
      const classId = 'class-grade-10';
      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
        classId,
        sectionId: null,
        title: 'Maths Quadratic Equations Assignment',
        maxMarks: 50,
      });

      prisma.assignmentSubmission.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          assignmentId,
          studentId: 'student-1',
          status: 'SUBMITTED',
          marksObtained: 45,
          feedback: 'Well done',
          submittedAt: new Date(),
          student: {
            user: {
              firstName: 'Aarav',
              lastName: 'Sharma',
              email: 'aarav@school.edu',
            },
            enrollments: [{ rollNumber: '10A01', sectionId: 'sec-1' }],
          },
        },
      ]);

      prisma.studentEnrollment.findMany.mockResolvedValue([
        {
          studentId: 'student-1',
          rollNumber: '10A01',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Aarav',
              lastName: 'Sharma',
              email: 'aarav@school.edu',
            },
          },
        },
        {
          studentId: 'student-2',
          rollNumber: '10A02',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Priya',
              lastName: 'Patel',
              email: 'priya@school.edu',
            },
          },
        },
      ]);

      const result = await service.getSubmissions(schoolId, assignmentId);

      // Verify that studentEnrollment.findMany was called with section: { classId } and NOT directly classId
      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          section: { classId },
        },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { rollNumber: 'asc' },
      });

      expect(result.submissions).toHaveLength(2);
      expect(result.submissions[0].studentName).toBe('Aarav Sharma');
      expect(result.submissions[0].status).toBe('SUBMITTED');
      expect(result.submissions[0].marksObtained).toBe(45);
      expect(result.submissions[1].studentName).toBe('Priya Patel');
      expect(result.submissions[1].status).toBe('PENDING');
      expect(result.submissions[1].marksObtained).toBeNull();
      expect(result.stats.totalStudents).toBe(2);
      expect(result.stats.submittedCount).toBe(1);
      expect(result.stats.pendingCount).toBe(1);
    });

    it('should query sectionId when sectionId is present (Section-level assignment)', async () => {
      const classId = 'class-grade-10';
      const sectionId = 'sec-10-A';
      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
        classId,
        sectionId,
        title: 'Science Lab Assignment',
        maxMarks: 20,
      });

      prisma.assignmentSubmission.findMany.mockResolvedValue([]);
      prisma.studentEnrollment.findMany.mockResolvedValue([
        {
          studentId: 'student-3',
          rollNumber: '10A03',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Rohan',
              lastName: 'Verma',
              email: 'rohan@school.edu',
            },
          },
        },
      ]);

      const result = await service.getSubmissions(schoolId, assignmentId);

      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          sectionId,
        },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { rollNumber: 'asc' },
      });

      expect(result.submissions).toHaveLength(1);
      expect(result.submissions[0].studentName).toBe('Rohan Verma');
      expect(result.submissions[0].status).toBe('PENDING');
    });
  });

  describe('submitAssignment', () => {
    it('should grade/upsert assignment submission successfully', async () => {
      const schoolId = 'school-123';
      const assignmentId = 'assign-1';
      const studentId = 'student-1';

      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
      });
      prisma.student.findFirst.mockResolvedValue({ id: studentId, schoolId });
      prisma.assignmentSubmission.upsert.mockResolvedValue({
        id: 'sub-1',
        assignmentId,
        studentId,
        marksObtained: 18,
        status: 'GRADED',
      });

      const res = await service.submitAssignment(
        schoolId,
        assignmentId,
        studentId,
        {
          marksObtained: 18,
          feedback: 'Excellent work',
          status: 'GRADED',
        },
      );

      expect(prisma.assignmentSubmission.upsert).toHaveBeenCalled();
      expect(res.status).toBe('GRADED');
    });
  });
});
