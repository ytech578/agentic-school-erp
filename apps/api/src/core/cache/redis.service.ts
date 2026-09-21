import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly fallbackStore = new Map<string, CacheEntry>();
  private readonly maxMemoryKeys = 5000;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>(
      'redis.url',
      'redis://localhost:6379',
    );
    const password = this.config.get<string>('redis.password');

    try {
      this.client = new Redis(redisUrl, {
        password: password || undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) {
            // Stop aggressive retries and stay in circuit-breaker fallback mode
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis cache cluster successfully');
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(
            `Redis disconnected: ${err.message}. Engaging circuit-breaker memory fallback.`,
          );
        }
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(
        `Failed to initialize Redis client: ${err.message}. Operating in resilient memory mode.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch (err: any) {
        this.logger.warn(
          `Redis GET failed for "${key}", checking memory fallback: ${err.message}`,
        );
      }
    }

    // Circuit-breaker in-memory fallback
    const entry = this.fallbackStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.fallbackStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch (err: any) {
        this.logger.warn(
          `Redis SET failed for "${key}", writing to memory fallback: ${err.message}`,
        );
      }
    }

    // Enforce memory store bound
    if (this.fallbackStore.size >= this.maxMemoryKeys) {
      const oldestKey = this.fallbackStore.keys().next().value;
      if (oldestKey) this.fallbackStore.delete(oldestKey);
    }

    const expiresAt =
      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.fallbackStore.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        this.logger.warn(`Redis DEL failed for "${key}": ${err.message}`);
      }
    }
    this.fallbackStore.delete(key);
  }

  getStatus(): {
    connected: boolean;
    mode: 'REDIS' | 'CIRCUIT_BREAKER_MEMORY';
    memoryKeysCount: number;
  } {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'REDIS' : 'CIRCUIT_BREAKER_MEMORY',
      memoryKeysCount: this.fallbackStore.size,
    };
  }
}
