import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { PrismaService } from '../../core/database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { ActivityCategory } from './dto/activity.dto';

const mockPrisma = {
  activity: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  student: { findFirst: jest.fn() },
};

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ActivitiesService>(ActivitiesService);
    jest.clearAllMocks();
  });

  describe('listActivities', () => {
    it('should throw ForbiddenException for empty schoolId', async () => {
      await expect(service.listActivities('')).rejects.toThrow();
    });

    it('should throw NotFoundException when filtering by nonexistent studentId', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      await expect(
        service.listActivities('school-1', 'nonexistent-student'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return activities with category field mapped from icon', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([
        { id: 'a1', title: 'Science Fair', icon: 'ACADEMIC', student: null },
      ]);
      const result = await service.listActivities('school-1');
      expect(result[0].category).toBe('ACADEMIC');
    });
  });

  describe('createActivity', () => {
    const validDto = {
      studentId: 'student-1',
      title: 'Math Olympiad',
      event: 'District Math Competition',
      date: '2024-03-15',
      category: ActivityCategory.ACADEMIC,
    };

    it('should throw NotFoundException if student not found', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      await expect(
        service.createActivity('school-1', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and return activity with category field', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      mockPrisma.activity.create.mockResolvedValue({
        id: 'act-1',
        ...validDto,
        date: new Date(validDto.date),
        icon: 'ACADEMIC',
      });
      const result = await service.createActivity('school-1', validDto);
      expect(result.category).toBe('ACADEMIC');
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Math Olympiad',
            icon: ActivityCategory.ACADEMIC,
          }),
        }),
      );
    });

    it('should default category to ACADEMIC when not provided', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      mockPrisma.activity.create.mockResolvedValue({
        id: 'act-1',
        icon: 'ACADEMIC',
      });
      const { category, ...dtoWithoutCategory } = validDto;
      await service.createActivity('school-1', dtoWithoutCategory);
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: 'ACADEMIC' }),
        }),
      );
    });
  });

  describe('updateActivity', () => {
    it('should throw NotFoundException if activity not found', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      await expect(
        service.updateActivity('school-1', 'nonexistent-id', {
          title: 'New Title',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        id: 'act-1',
        icon: 'ACADEMIC',
      });
      mockPrisma.activity.update.mockResolvedValue({
        id: 'act-1',
        title: 'Updated',
        icon: 'SPORTS',
      });
      await service.updateActivity('school-1', 'act-1', {
        title: 'Updated',
        category: ActivityCategory.SPORTS,
      });
      expect(mockPrisma.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Updated', icon: 'SPORTS' }),
        }),
      );
    });
  });

  describe('deleteActivity', () => {
    it('should throw NotFoundException if activity not found', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteActivity('school-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete and return the deleted activity', async () => {
      const mockActivity = { id: 'act-1', schoolId: 'school-1' };
      mockPrisma.activity.findFirst.mockResolvedValue(mockActivity);
      mockPrisma.activity.delete.mockResolvedValue(mockActivity);
      const result = await service.deleteActivity('school-1', 'act-1');
      expect(result.id).toBe('act-1');
    });
  });
});
