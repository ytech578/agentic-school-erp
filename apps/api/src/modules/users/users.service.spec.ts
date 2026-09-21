import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findAll returns paginated users and meta', async () => {
    const mockUsers = [
      {
        id: 'u1',
        email: 'student1@school.edu',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
      {
        id: 'u2',
        email: 'teacher1@school.edu',
        role: 'TEACHER',
        status: 'ACTIVE',
      },
    ];
    prisma.user.findMany.mockResolvedValue(mockUsers);
    prisma.user.count.mockResolvedValue(45);

    const res = await service.findAll('school-1', { page: 1, limit: 15 });

    expect(res.data).toEqual(mockUsers);
    expect(res.meta).toEqual({
      total: 45,
      page: 1,
      limit: 15,
      totalPages: 3,
    });
  });

  it('getStats calculates aggregate and by-role counts', async () => {
    prisma.user.count
      .mockResolvedValueOnce(1200) // total
      .mockResolvedValueOnce(1150) // active
      .mockResolvedValueOnce(50); // inactive

    prisma.user.groupBy.mockResolvedValue([
      { role: 'STUDENT', _count: { _all: 500 } },
      { role: 'PARENT', _count: { _all: 600 } },
      { role: 'TEACHER', _count: { _all: 90 } },
      { role: 'SCHOOL_ADMIN', _count: { _all: 8 } },
      { role: 'PRINCIPAL', _count: { _all: 2 } },
    ]);

    const stats = await service.getStats('school-1');

    expect(stats.total).toBe(1200);
    expect(stats.active).toBe(1150);
    expect(stats.inactive).toBe(50);
    expect(stats.byRole.STUDENT).toBe(500);
    expect(stats.byRole.PARENT).toBe(600);
    expect(stats.byRole.TEACHER).toBe(90);
  });
});
