import { Test, TestingModule } from '@nestjs/testing';
import { HRService } from './hr.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('HRService', () => {
  let service: HRService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      department: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      designation: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      staff: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HRService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<HRService>(HRService);
  });

  it('should get departments with headcount stats', async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: 'dept_1', name: 'Science', _count: { staff: 12 } },
      { id: 'dept_2', name: 'Mathematics', _count: { staff: 8 } },
    ]);

    const res = await service.getDepartmentsWithStats('school_1');
    expect(res).toHaveLength(2);
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school_1' },
      include: {
        _count: { select: { staff: true } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('should create a department', async () => {
    mockPrisma.department.create.mockResolvedValue({
      id: 'dept_new',
      schoolId: 'school_1',
      name: 'Humanities',
      description: 'Arts and Social Sciences',
    });

    const res = await service.createDepartment('school_1', {
      name: 'Humanities',
      description: 'Arts and Social Sciences',
    });
    expect(res.name).toBe('Humanities');
    expect(mockPrisma.department.create).toHaveBeenCalled();
  });

  it('should return staff roster with filtering and pagination', async () => {
    mockPrisma.staff.findMany.mockResolvedValue([
      {
        id: 'staff_1',
        employeeId: 'EMP-001',
        user: {
          firstName: 'Ravi',
          lastName: 'Kumar',
          email: 'ravi@school.edu',
        },
      },
    ]);
    mockPrisma.staff.count.mockResolvedValue(1);

    const res = await service.getStaffRoster('school_1', {
      page: 1,
      limit: 10,
    });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
  });

  it('should compute leave balances with standard quotas', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff_1' });
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      { leaveType: 'CASUAL', totalDays: 3 },
      { leaveType: 'SICK', totalDays: 2 },
    ]);

    const res = await service.getLeaveBalances('school_1', 'user_1');
    expect(res).toBeDefined();
    const casual = res.find((r: any) => r.type === 'CASUAL');
    expect(casual).toBeDefined();
    expect(casual!.quota).toBe(12);
    expect(casual!.used).toBe(3);
    expect(casual!.balance).toBe(9);

    const sick = res.find((r: any) => r.type === 'SICK');
    expect(sick).toBeDefined();
    expect(sick!.quota).toBe(10);
    expect(sick!.used).toBe(2);
    expect(sick!.balance).toBe(8);
  });
});
