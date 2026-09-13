import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AttendanceStatus, AttendanceMethod } from '@prisma/client';

describe('AttendanceService - Hardware Punch Webhook', () => {
  let service: AttendanceService;
  let mockPrisma: any;

  const mockStudent = {
    id: 'student_123',
    schoolId: 'school_1',
    admissionNumber: 'ADM-2025-0142',
    aadhaarNumber: '123456789012',
    user: { firstName: 'Aarav', lastName: 'Sharma' },
    enrollments: [{ sectionId: 'section_10a' }],
  };

  const mockStaff = {
    id: 'staff_456',
    schoolId: 'school_1',
    employeeId: 'EMP-007',
    aadhaarNumber: '987654321098',
    user: { firstName: 'Rajesh', lastName: 'Verma' },
  };

  beforeEach(async () => {
    mockPrisma = {
      student: {
        findFirst: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
      attendanceRecord: {
        upsert: jest.fn(),
      },
      staffAttendance: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  it('should successfully record RFID attendance for a student', async () => {
    mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
    mockPrisma.attendanceRecord.upsert.mockResolvedValue({
      id: 'rec_001',
      method: AttendanceMethod.RFID,
      status: AttendanceStatus.PRESENT,
    });

    const result = await service.handleHardwarePunch({
      deviceId: 'GATE_READER_RFID_01',
      cardId: 'ADM-2025-0142',
      timestamp: '2026-09-13T08:15:00.000Z',
      scanType: 'IN',
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('STUDENT');
    expect(result.student?.name).toBe('Aarav Sharma');
    expect(result.method).toBe(AttendanceMethod.RFID);
    expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          studentId: 'student_123',
          sectionId: 'section_10a',
          method: AttendanceMethod.RFID,
          status: AttendanceStatus.PRESENT,
        }),
      }),
    );
  });

  it('should automatically assign BIOMETRIC method if deviceId indicates biometric terminal', async () => {
    mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
    mockPrisma.attendanceRecord.upsert.mockResolvedValue({
      id: 'rec_002',
      method: AttendanceMethod.BIOMETRIC,
      status: AttendanceStatus.PRESENT,
    });

    const result = await service.handleHardwarePunch({
      deviceId: 'BIOMETRIC_FINGERPRINT_TERMINAL_MAIN',
      cardId: 'ADM-2025-0142',
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe(AttendanceMethod.BIOMETRIC);
    expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          method: AttendanceMethod.BIOMETRIC,
        }),
      }),
    );
  });

  it('should successfully record staff attendance if cardId matches employeeId', async () => {
    mockPrisma.student.findFirst.mockResolvedValue(null);
    mockPrisma.staff.findFirst.mockResolvedValue(mockStaff);
    mockPrisma.staffAttendance.upsert.mockResolvedValue({
      id: 'staff_rec_001',
      status: AttendanceStatus.PRESENT,
    });

    const result = await service.handleHardwarePunch({
      deviceId: 'STAFF_ROOM_RFID',
      cardId: 'EMP-007',
      scanType: 'IN',
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('STAFF');
    expect(result.staff?.name).toBe('Rajesh Verma');
    expect(mockPrisma.staffAttendance.upsert).toHaveBeenCalled();
  });

  it('should throw BadRequestException if deviceId or cardId is missing', async () => {
    await expect(
      service.handleHardwarePunch({ deviceId: '', cardId: '123' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.handleHardwarePunch({ deviceId: 'DEV_1', cardId: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if credential does not match student or staff', async () => {
    mockPrisma.student.findFirst.mockResolvedValue(null);
    mockPrisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.handleHardwarePunch({
        deviceId: 'MAIN_GATE',
        cardId: 'UNKNOWN_RFID_CHIP_9999',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
