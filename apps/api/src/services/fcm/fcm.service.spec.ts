import { Test, TestingModule } from '@nestjs/testing';
import { FcmService } from './fcm.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('FcmService', () => {
  let service: FcmService;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    prisma = {
      deviceToken: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FcmService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null), // Graceful mock mode in tests
          },
        },
      ],
    }).compile();

    service = module.get<FcmService>(FcmService);
    service.onModuleInit();
  });

  it('should register a device token', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({
      id: 'dt-1',
      token: 'fcm-token-123',
    });

    const res = await service.registerToken(
      'user-1',
      'school-1',
      'fcm-token-123',
      'ANDROID',
    );

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'fcm-token-123' },
        create: expect.objectContaining({
          userId: 'user-1',
          schoolId: 'school-1',
          token: 'fcm-token-123',
          platform: 'ANDROID',
        }),
      }),
    );
    expect(res).toBeDefined();
  });

  it('should unregister a device token', async () => {
    await service.unregisterToken('fcm-token-123');
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'fcm-token-123' },
    });
  });

  it('should send push notification in mock dev mode without crashing', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'fcm-token-123' },
      { token: 'fcm-token-456' },
    ]);

    const res = await service.sendToUser('user-1', {
      title: 'Exam Schedule Published',
      body: 'Midterm exam date sheet has been released.',
    });

    expect(res).toBe(true);
  });

  it('should skip sendToUser if no tokens registered', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([]);

    const res = await service.sendToUser('user-without-tokens', {
      title: 'Fee Due',
      body: 'Reminder to pay fees.',
    });

    expect(res).toBe(false);
  });
});
