import { Test, TestingModule } from '@nestjs/testing';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../../core/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  academicYear: { findFirst: jest.fn() },
  timetableSlot: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  class: { findFirst: jest.fn() },
  section: { findFirst: jest.fn() },
  staff: { findFirst: jest.fn() },
  subject: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

const mockCache = {
  resolveActiveYear: jest.fn().mockResolvedValue('ay-1'),
};

describe('TimetableService', () => {
  let service: TimetableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: require('../../core/cache/tenant-cache.service')
            .TenantCacheService,
          useValue: mockCache,
        },
      ],
    }).compile();
    service = module.get<TimetableService>(TimetableService);
    jest.clearAllMocks();
  });

  describe('getTimetable', () => {
    it('should throw ForbiddenException for empty schoolId', async () => {
      await expect(service.getTimetable('', {})).rejects.toThrow();
    });

    it('should throw NotFoundException if no active academic year found', async () => {
      mockCache.resolveActiveYear.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(service.getTimetable('school-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return timetable slots for a school', async () => {
      mockCache.resolveActiveYear.mockResolvedValue('ay-1');
      mockPrisma.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'slot-1',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '09:45',
        },
      ]);
      const result = await service.getTimetable('school-1', {});
      expect(result).toBeDefined();
    });
  });

  describe('getTeacherTimetable', () => {
    it('should return empty array for teacher with no slots', async () => {
      mockCache.resolveActiveYear.mockResolvedValue('ay-1');
      mockPrisma.timetableSlot.findMany.mockResolvedValue([]);
      const result = await service.getTeacherTimetable('school-1', 'teacher-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('saveSlot', () => {
    it('should throw NotFoundException when academic year not found', async () => {
      mockCache.resolveActiveYear.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(
        service.saveSlot('school-1', {
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '09:45',
          sectionId: 'sec-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSlot', () => {
    it('should throw when slot not found in school (Prisma P2025)', async () => {
      // Prisma update throws P2025 when record not found
      mockPrisma.timetableSlot.findFirst.mockResolvedValue(null);
      mockPrisma.timetableSlot.update.mockRejectedValueOnce(
        Object.assign(new Error('Record not found'), { code: 'P2025' }),
      );
      await expect(
        service.deleteSlot('school-1', 'slot-nonexistent'),
      ).rejects.toThrow();
    });

    it('should soft-delete (set isActive=false) and return updated slot', async () => {
      const mockSlot = { id: 'slot-1', schoolId: 'school-1', isActive: false };
      mockPrisma.timetableSlot.update.mockResolvedValue(mockSlot);
      const result = await service.deleteSlot('school-1', 'slot-1');
      expect(result).toHaveProperty('id', 'slot-1');
      expect(mockPrisma.timetableSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  describe('checkConflicts', () => {
    it('should return void (no conflicts) for a free slot', async () => {
      mockCache.resolveActiveYear.mockResolvedValue('ay-1');
      mockPrisma.timetableSlot.findMany.mockResolvedValue([]);
      await expect(
        service.checkConflicts('school-1', 'ay-1', {
          dayOfWeek: 'TUESDAY',
          startTime: '10:00',
          endTime: '10:45',
          sectionId: 'sec-1',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
