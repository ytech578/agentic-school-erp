import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  HttpException,
  HttpStatus,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AIResilienceService, CircuitState } from './ai-resilience.service';
import { RedisService } from '../../core/cache/redis.service';

describe('AIResilienceService', () => {
  let service: AIResilienceService;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const mockRedisStore = new Map<string, string>();

  beforeEach(async () => {
    mockRedisStore.clear();

    redisService = {
      get: jest
        .fn()
        .mockImplementation(
          async (key: string) => mockRedisStore.get(key) || null,
        ),
      set: jest.fn().mockImplementation(async (key: string, value: string) => {
        mockRedisStore.set(key, value);
      }),
      del: jest.fn().mockImplementation(async (key: string) => {
        mockRedisStore.delete(key);
      }),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, fallback: any) => {
        if (key === 'ai.requestTimeoutMs') return 500; // Fast for testing
        if (key === 'ai.maxRetries') return 2;
        if (key === 'ai.rateLimitPerMinute') return 3; // Low for testing
        if (key === 'ai.monthlyTokenQuota') return 5000;
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIResilienceService,
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AIResilienceService>(AIResilienceService);
  });

  it('should successfully execute an AI function call', async () => {
    const fn = jest.fn().mockResolvedValue('ai response output');
    const result = await service.execute(fn, { schoolId: 'school-1' });

    expect(result).toBe('ai response output');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(service.getCircuitStatus().state).toBe(CircuitState.CLOSED);
  });

  it('should timeout if execution takes longer than timeoutMs', async () => {
    const slowFn = () =>
      new Promise((resolve) => setTimeout(() => resolve('slow'), 1000));

    await expect(
      service.execute(slowFn, {
        schoolId: 'school-1',
        timeoutMs: 100,
        maxRetries: 0,
      }),
    ).rejects.toThrow('timed out');
  });

  it('should retry on transient 429 error with backoff and succeed', async () => {
    let calls = 0;
    const transientFn = jest.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        const error: any = new Error('Resource exhausted (429)');
        error.status = 429;
        throw error;
      }
      return 'recovered response';
    });

    const result = await service.execute(transientFn, {
      schoolId: 'school-1',
      maxRetries: 2,
    });

    expect(result).toBe('recovered response');
    expect(calls).toBe(2);
    expect(service.getCircuitStatus().state).toBe(CircuitState.CLOSED);
  });

  it('should trip circuit breaker after 5 consecutive failures and fail fast', async () => {
    const failingFn = jest
      .fn()
      .mockRejectedValue(new Error('Fatal upstream failure'));

    for (let i = 0; i < 5; i++) {
      await expect(
        service.execute(failingFn, {
          schoolId: `school-failure-${i}`,
          maxRetries: 0,
        }),
      ).rejects.toThrow('Fatal upstream failure');
    }

    expect(service.getCircuitStatus().state).toBe(CircuitState.OPEN);

    // 6th call should immediately fail with ServiceUnavailableException without calling fn
    const newFn = jest.fn();
    await expect(
      service.execute(newFn, { schoolId: 'school-another' }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(newFn).not.toHaveBeenCalled();
  });

  it('should enforce per-school rate limit per minute', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    // Limit is 3
    await service.execute(fn, { schoolId: 'school-limited' });
    await service.execute(fn, { schoolId: 'school-limited' });
    await service.execute(fn, { schoolId: 'school-limited' });

    // 4th request in the same minute should be rejected with 429
    await expect(
      service.execute(fn, { schoolId: 'school-limited' }),
    ).rejects.toThrow(HttpException);
  });

  it('should enforce monthly token quota per school', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    // Quota is 5000; execute with 4000 tokens
    await service.execute(fn, {
      schoolId: 'school-quota',
      estimatedTokens: 4000,
    });

    // 2nd execution with 1500 tokens exceeds 5000
    await service.execute(fn, {
      schoolId: 'school-quota',
      estimatedTokens: 1500,
    });

    // Next execution should throw ForbiddenException
    await expect(
      service.execute(fn, { schoolId: 'school-quota', estimatedTokens: 100 }),
    ).rejects.toThrow(ForbiddenException);
  });
});
