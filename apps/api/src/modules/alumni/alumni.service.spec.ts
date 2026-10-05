import { Test, TestingModule } from '@nestjs/testing';
import { AlumniService } from './alumni.service';
import { PrismaService } from '../../core/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AlumniService', () => {
  let service: AlumniService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';

  beforeEach(async () => {
    prisma = {
      student: {
        findFirst: jest.fn(),
      },
      alumniProfile: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      transcriptRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlumniService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AlumniService>(AlumniService);
  });

  describe('upsertAlumniProfile', () => {
    it('should throw NotFoundException if student is not found in school', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertAlumniProfile(mockSchoolId, {
          studentId: 'stud-nonexistent',
          graduationYear: 2024,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert profile when student exists in school', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'stud-1',
        schoolId: mockSchoolId,
      });
      prisma.alumniProfile.upsert.mockResolvedValue({
        id: 'prof-1',
        studentId: 'stud-1',
        graduationYear: 2024,
        company: 'Infosys',
      });

      const res = await service.upsertAlumniProfile(mockSchoolId, {
        studentId: 'stud-1',
        graduationYear: 2024,
        company: 'Infosys',
        currentStatus: 'EMPLOYED',
      });

      expect(res.company).toBe('Infosys');
      expect(prisma.alumniProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'stud-1' },
          create: expect.objectContaining({
            graduationYear: 2024,
            company: 'Infosys',
          }),
        }),
      );
    });
  });

  describe('getAlumniProfiles', () => {
    it('should query alumni profiles with pagination and filters', async () => {
      prisma.alumniProfile.findMany.mockResolvedValue([
        { id: 'prof-1', graduationYear: 2024, student: { firstName: 'Rohan' } },
      ]);
      prisma.alumniProfile.count.mockResolvedValue(1);

      const res = await service.getAlumniProfiles(mockSchoolId, {
        graduationYear: 2024,
        page: 1,
        limit: 10,
      });

      expect(res.total).toBe(1);
      expect(res.items.length).toBe(1);
      expect(prisma.alumniProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: mockSchoolId,
            graduationYear: 2024,
          }),
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('getAlumniProfileByStudentId', () => {
    it('should throw NotFoundException if profile is not found', async () => {
      prisma.alumniProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getAlumniProfileByStudentId(mockSchoolId, 'stud-404'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return profile if found', async () => {
      prisma.alumniProfile.findFirst.mockResolvedValue({
        id: 'prof-1',
        studentId: 'stud-1',
      });

      const res = await service.getAlumniProfileByStudentId(
        mockSchoolId,
        'stud-1',
      );
      expect(res.id).toBe('prof-1');
    });
  });

  describe('createTranscriptRequest', () => {
    it('should throw NotFoundException if student does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.createTranscriptRequest(mockSchoolId, {
          studentId: 'stud-404',
          purpose: 'Higher Studies',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create transcript request with unique requestNumber and SUBMITTED status', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'stud-1',
        schoolId: mockSchoolId,
      });
      prisma.transcriptRequest.create.mockResolvedValue({
        id: 'tr-1',
        requestNumber: 'TR-2026-123456',
        status: 'SUBMITTED',
        purpose: 'Higher Studies',
      });

      const res = await service.createTranscriptRequest(mockSchoolId, {
        studentId: 'stud-1',
        purpose: 'Higher Studies',
        deliveryMode: 'DIGITAL',
      });

      expect(res.status).toBe('SUBMITTED');
      expect(prisma.transcriptRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'stud-1',
            purpose: 'Higher Studies',
            deliveryMode: 'DIGITAL',
            status: 'SUBMITTED',
          }),
        }),
      );
    });
  });

  describe('updateTranscriptRequestStatus', () => {
    it('should throw NotFoundException if transcript request not found', async () => {
      prisma.transcriptRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTranscriptRequestStatus(mockSchoolId, 'tr-999', {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update transcript request status and documentUrl', async () => {
      prisma.transcriptRequest.findFirst.mockResolvedValue({
        id: 'tr-1',
        schoolId: mockSchoolId,
        status: 'SUBMITTED',
      });
      prisma.transcriptRequest.update.mockResolvedValue({
        id: 'tr-1',
        status: 'COMPLETED',
        documentUrl: 'https://s3.aws.com/transcripts/tr-1.pdf',
      });

      const res = await service.updateTranscriptRequestStatus(
        mockSchoolId,
        'tr-1',
        {
          status: 'COMPLETED',
          documentUrl: 'https://s3.aws.com/transcripts/tr-1.pdf',
        },
      );

      expect(res.status).toBe('COMPLETED');
      expect(prisma.transcriptRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tr-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            documentUrl: 'https://s3.aws.com/transcripts/tr-1.pdf',
          }),
        }),
      );
    });
  });

  describe('getAlumniDirectoryStats', () => {
    it('should compute aggregate counts and breakdown by graduation year and status', async () => {
      prisma.alumniProfile.count.mockResolvedValue(4);
      prisma.transcriptRequest.count.mockResolvedValue(2);
      prisma.alumniProfile.findMany.mockResolvedValue([
        { graduationYear: 2023, currentStatus: 'EMPLOYED' },
        { graduationYear: 2023, currentStatus: 'EMPLOYED' },
        { graduationYear: 2024, currentStatus: 'HIGHER_STUDIES' },
        { graduationYear: 2024, currentStatus: 'EMPLOYED' },
      ]);

      const res = await service.getAlumniDirectoryStats(mockSchoolId);

      expect(res.totalAlumni).toBe(4);
      expect(res.pendingTranscripts).toBe(2);
      expect(res.byYear).toEqual({ 2023: 2, 2024: 2 });
      expect(res.byStatus).toEqual({ EMPLOYED: 3, HIGHER_STUDIES: 1 });
    });
  });
});
