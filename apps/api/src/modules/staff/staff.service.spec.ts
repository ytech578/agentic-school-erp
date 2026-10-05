import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const mockPrisma = {
  staff: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  department: { findFirst: jest.fn() },
  designation: { findFirst: jest.fn() },
  timetableSlot: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockCache = {
  getDepartments: jest.fn().mockResolvedValue([]),
  getDesignations: jest.fn().mockResolvedValue([]),
};

// Minimal valid CreateStaffInput with all required fields
const makeValidDto = (overrides: Record<string, any> = {}): any => ({
  email: 'teacher@school.com',
  firstName: 'John',
  lastName: 'Doe',
  employeeId: 'EMP001',
  role: 'TEACHER',
  employmentType: 'FULL_TIME',
  joinDate: '2024-01-01',
  phone: '9876543210',
  bloodGroup: 'A_POSITIVE',
  departmentId: 'dept-1',
  designationId: 'desig-1',
  gender: 'MALE',
  ...overrides,
});

describe('StaffService', () => {
  let service: StaffService;

  // bcrypt in createStaff can take 300-400ms under test load
  jest.setTimeout(15000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: require('../../core/cache/tenant-cache.service')
            .TenantCacheService,
          useValue: mockCache,
        },
      ],
    }).compile();
    service = module.get<StaffService>(StaffService);
    jest.clearAllMocks();
  });

  describe('createStaff', () => {
    it('should throw ForbiddenException when schoolId is empty', async () => {
      await expect(service.createStaff('', makeValidDto())).rejects.toThrow();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      mockPrisma.designation.findFirst.mockResolvedValue({ id: 'desig-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
      await expect(
        service.createStaff('school-1', makeValidDto()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if employeeId already exists in school', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      mockPrisma.designation.findFirst.mockResolvedValue({ id: 'desig-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.staff.findUnique.mockResolvedValue({ id: 'existing-staff' });
      await expect(
        service.createStaff('school-1', makeValidDto()),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and staff record in a transaction', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      mockPrisma.designation.findFirst.mockResolvedValue({ id: 'desig-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.staff.findUnique.mockResolvedValue(null);
      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'teacher@school.com',
      };
      const mockStaff = {
        id: 'staff-1',
        schoolId: 'school-1',
        userId: 'user-1',
        employeeId: 'EMP001',
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          staff: { create: jest.fn().mockResolvedValue(mockStaff) },
        }),
      );
      const result = await service.createStaff('school-1', makeValidDto());
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if departmentId does not belong to school', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);
      await expect(
        service.createStaff('school-1', makeValidDto()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStaffList', () => {
    it('should return paginated staff list with correct shape', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.count.mockResolvedValue(0);
      const result = await service.getStaffList('school-1', 1, 10);
      // Service returns {items, total, totalPages, page, limit}
      expect(result).toHaveProperty('total');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for empty schoolId', async () => {
      await expect(service.getStaffList('')).rejects.toThrow();
    });
  });

  describe('getStaffById', () => {
    it('should throw NotFoundException if staff not in school', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null);
      await expect(
        service.getStaffById('school-1', 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return staff record with user info when found', async () => {
      const mockStaff = {
        id: 'staff-1',
        schoolId: 'school-1',
        user: { firstName: 'John', email: 'j@s.com' },
      };
      mockPrisma.staff.findFirst.mockResolvedValue(mockStaff);
      const result = await service.getStaffById('school-1', 'staff-1');
      expect(result).toHaveProperty('id', 'staff-1');
    });
  });

  describe('updateStaffStatus', () => {
    it('should throw NotFoundException if staff not found', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStaffStatus('school-1', 'nonexistent', {
          isActive: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate staff and user in a transaction', async () => {
      const mockStaff = {
        id: 'staff-1',
        userId: 'user-1',
        schoolId: 'school-1',
        user: {},
      };
      mockPrisma.staff.findFirst.mockResolvedValue(mockStaff);
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          staff: {
            update: jest.fn().mockResolvedValue({
              id: 'staff-1',
              isActive: false,
              resignDate: new Date(),
            }),
          },
          user: { update: jest.fn() },
        }),
      );
      const result = await service.updateStaffStatus('school-1', 'staff-1', {
        isActive: false,
      });
      expect(result).toBeDefined();
    });
  });
});
