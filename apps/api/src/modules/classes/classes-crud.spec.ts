import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('ClassesService - CRUD Operations', () => {
  let service: ClassesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ay-active', name: '2026-27', isActive: true }),
      },
      class: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      section: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      subject: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  it('creates class with sections', async () => {
    prisma.class.findUnique.mockResolvedValue(null);
    prisma.class.create.mockResolvedValue({
      id: 'class-1',
      name: 'Class 10',
      numericLevel: 10,
      sections: [{ id: 'sec-a', name: 'A' }, { id: 'sec-b', name: 'B' }],
    });

    const res = await service.createClass('school-1', {
      name: 'Class 10',
      sections: ['A', 'B'],
    });

    expect(res.name).toBe('Class 10');
    expect(prisma.class.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: 'school-1',
          name: 'Class 10',
          numericLevel: 10,
        }),
      }),
    );
  });

  it('prevents duplicate class in same academic year', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createClass('school-1', {
        name: 'Class 10',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents deleting a class with enrolled students', async () => {
    prisma.class.findFirst.mockResolvedValue({
      id: 'class-1',
      name: 'Class 10',
      sections: [
        { id: 'sec-a', _count: { enrollments: 35 } },
      ],
    });

    await expect(service.deleteClass('school-1', 'class-1')).rejects.toThrow(BadRequestException);
  });

  it('creates section in existing class', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1', name: 'Class 10' });
    prisma.section.findUnique.mockResolvedValue(null);
    prisma.section.create.mockResolvedValue({ id: 'sec-c', name: 'C', capacity: 45 });

    const res = await service.createSection('school-1', 'class-1', {
      name: 'C',
      capacity: 45,
      roomNumber: 'Room 205',
    });

    expect(res.name).toBe('C');
    expect(prisma.section.create).toHaveBeenCalledWith({
      data: {
        classId: 'class-1',
        name: 'C',
        capacity: 45,
        roomNumber: 'Room 205',
      },
    });
  });
});
