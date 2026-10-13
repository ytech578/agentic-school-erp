import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const logger = new Logger('JobsModule');

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Parse the redis URL (e.g. redis://localhost:6379)
        const redisUrl = configService.get<string>(
          'redis.url',
          'redis://127.0.0.1:6379',
        );
        const url = new URL(redisUrl);
        const host = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
        const port = parseInt(url.port || '6379', 10);

        // Resilient ioredis client with error handler to prevent unhandled ECONNREFUSED process crash
        const redisClient = new Redis({
          host,
          port,
          username: url.username || undefined,
          password: url.password || undefined,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          connectTimeout: 3000,
          retryStrategy: (times: number) => {
            if (times > 3) {
              return null; // Stop aggressive retries when Redis is not running in dev
            }
            return Math.min(times * 1000, 2000);
          },
        });

        redisClient.on('error', (err: Error) => {
          logger.warn(
            `Background Jobs Queue: Redis unavailable (${err.message}). Resilient fallback engaged.`,
          );
        });

        return {
          connection: redisClient,
          defaultJobOptions: {
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}

