import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../core/cache/redis.service';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface AIExecutionOptions {
  schoolId?: string;
  operationName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  estimatedTokens?: number;
}

@Injectable()
export class AIResilienceService {
  private readonly logger = new Logger(AIResilienceService.name);

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private readonly failureThreshold = 5;
  private lastFailureTime = 0;
  private readonly cooldownPeriodMs = 60000; // 60s
  private halfOpenProbeInFlight = false;

  // Configuration defaults
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;
  private readonly rateLimitPerMinute: number;
  private readonly monthlyTokenQuota: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.defaultTimeoutMs = this.config.get<number>(
      'ai.requestTimeoutMs',
      20000,
    );
    this.defaultMaxRetries = this.config.get<number>('ai.maxRetries', 2);
    this.rateLimitPerMinute = this.config.get<number>(
      'ai.rateLimitPerMinute',
      60,
    );
    this.monthlyTokenQuota = this.config.get<number>(
      'ai.monthlyTokenQuota',
      2000000,
    );
  }

  // Method to check rate limit and token quota for a tenant
  private async checkTenantQuotas(
    schoolId: string,
    estimatedTokens = 100,
  ): Promise<void> {
    if (!schoolId) return;

    const now = new Date();
    const minuteKey = `ai:ratelimit:${schoolId}:${Math.floor(now.getTime() / 60000)}`;
    const monthKey = `ai:quota:${schoolId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Rate Limit per minute
    const currentRpmStr = await this.redis.get(minuteKey);
    const currentRpm = currentRpmStr ? parseInt(currentRpmStr, 10) : 0;
    if (currentRpm >= this.rateLimitPerMinute) {
      this.logger.warn(
        `School ${schoolId} exceeded AI rate limit of ${this.rateLimitPerMinute} req/min`,
      );
      throw new HttpException(
        `AI rate limit exceeded for this school (${this.rateLimitPerMinute} requests/minute). Please retry shortly.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.redis.set(minuteKey, String(currentRpm + 1), 60);

    // 2. Monthly Token Quota
    const currentTokensStr = await this.redis.get(monthKey);
    const currentTokens = currentTokensStr ? parseInt(currentTokensStr, 10) : 0;
    if (currentTokens >= this.monthlyTokenQuota) {
      this.logger.warn(
        `School ${schoolId} exceeded monthly AI token quota (${currentTokens}/${this.monthlyTokenQuota})`,
      );
      throw new ForbiddenException(
        `Monthly AI quota exceeded for this school (${this.monthlyTokenQuota} tokens). Please upgrade your subscription tier.`,
      );
    }
    // Record estimated tokens with 32-day TTL
    await this.redis.set(
      monthKey,
      String(currentTokens + estimatedTokens),
      32 * 24 * 3600,
    );
  }

  // Method to check circuit breaker
  private checkCircuitBreaker(): void {
    const now = Date.now();
    if (this.circuitState === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        this.logger.log('Circuit breaker entering HALF_OPEN probe state');
        this.circuitState = CircuitState.HALF_OPEN;
        this.halfOpenProbeInFlight = false;
      } else {
        throw new ServiceUnavailableException(
          'AI service is temporarily unavailable due to upstream instability. Circuit breaker active.',
        );
      }
    }

    if (
      this.circuitState === CircuitState.HALF_OPEN &&
      this.halfOpenProbeInFlight
    ) {
      throw new ServiceUnavailableException(
        'AI service is currently testing upstream health. Please retry shortly.',
      );
    }
  }

  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN || this.failureCount > 0) {
      this.logger.log(
        'AI upstream call succeeded; circuit breaker reset to CLOSED',
      );
    }
    this.failureCount = 0;
    this.circuitState = CircuitState.CLOSED;
    this.halfOpenProbeInFlight = false;
  }

  private recordFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.circuitState === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.circuitState = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker tripped to OPEN! Consecutive failures: ${this.failureCount}. Reason: ${error?.message || error}`,
      );
    }
  }

  // Check if error is transient and retryable (429, 503, 504, ECONNRESET, ETIMEDOUT, timeout)
  private isRetryable(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const status = error.status || error.statusCode || error.response?.status;
    return (
      status === 429 ||
      status === 503 ||
      status === 504 ||
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('too many requests') ||
      msg.includes('503') ||
      msg.includes('unavailable') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('econnreset')
    );
  }

  // Execute an arbitrary AI call (e.g. model.generateContent) with timeout, retry, circuit breaker & quota
  async execute<T>(
    fn: () => Promise<T>,
    options: AIExecutionOptions = {},
  ): Promise<T> {
    const {
      schoolId = '',
      operationName = 'generateContent',
      timeoutMs = this.defaultTimeoutMs,
      maxRetries = this.defaultMaxRetries,
      estimatedTokens = 100,
    } = options;

    // 1. Quota & rate limit check
    if (schoolId) {
      await this.checkTenantQuotas(schoolId, estimatedTokens);
    }

    // 2. Circuit breaker check
    this.checkCircuitBreaker();
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.halfOpenProbeInFlight = true;
    }

    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        // Run with timeout race
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(new Error(`AI request timed out after ${timeoutMs}ms`)),
              timeoutMs,
            ),
          ),
        ]);

        const latencyMs = Date.now() - startTime;
        this.recordSuccess();
        this.logger.debug(
          `[AI Resilience] [${operationName}] School: ${schoolId || 'none'} | Latency: ${latencyMs}ms | Attempt: ${attempt}`,
        );
        return result;
      } catch (err: any) {
        const isLastAttempt = attempt > maxRetries;
        const retryable = this.isRetryable(err);

        if (!retryable || isLastAttempt) {
          this.recordFailure(err);
          const latencyMs = Date.now() - startTime;
          this.logger.error(
            `[AI Resilience] [${operationName}] Failed after ${attempt} attempts (${latencyMs}ms): ${err?.message || err}`,
          );
          throw err;
        }

        // Exponential backoff with jitter: base 1000ms, max 5000ms
        const delay = Math.min(
          1000 * Math.pow(2, attempt - 1) + Math.random() * 500,
          5000,
        );
        this.logger.warn(
          `[AI Resilience] [${operationName}] Transient failure on attempt ${attempt}: ${err?.message}. Retrying in ${Math.round(delay)}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new ServiceUnavailableException('AI request failed after retries.');
  }

  getCircuitStatus() {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  // Testing helper to simulate failure trips
  forceTripCircuit(): void {
    this.circuitState = CircuitState.OPEN;
    this.failureCount = this.failureThreshold;
    this.lastFailureTime = Date.now();
  }

  resetCircuit(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenProbeInFlight = false;
  }
}
