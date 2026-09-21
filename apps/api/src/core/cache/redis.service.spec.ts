import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService & Circuit Breaker (FIX-06)', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultVal: any) => {
                if (key === 'redis.url')
                  return 'redis://invalid-host-for-testing:6379';
                return defaultVal;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    // Initialize without throwing
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('operates in circuit-breaker in-memory fallback mode when Redis host is unreachable', async () => {
    const status = service.getStatus();
    expect(status.mode).toBe('CIRCUIT_BREAKER_MEMORY');
    expect(status.connected).toBe(false);
  });

  it('successfully stores and retrieves keys in memory fallback mode', async () => {
    await service.set('test-key', 'test-value');
    const value = await service.get('test-key');
    expect(value).toBe('test-value');
  });

  it('deletes keys correctly in memory fallback mode', async () => {
    await service.set('delete-me', '12345');
    await service.del('delete-me');
    const value = await service.get('delete-me');
    expect(value).toBeNull();
  });

  it('honors TTL expiration in memory fallback mode', async () => {
    // TTL of 0.05 seconds (50ms)
    await service.set('temp-key', 'expires-soon', 0.05);
    expect(await service.get('temp-key')).toBe('expires-soon');

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await service.get('temp-key')).toBeNull();
  });
});
