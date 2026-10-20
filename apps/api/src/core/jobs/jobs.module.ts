import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

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

        return {
          // Pass connection options instead of an externally-owned client.
          // BullMQ then owns and closes every connection during application
          // shutdown, preventing leaked sockets in deploys and test runners.
          connection: {
            host,
            port,
            username: url.username || undefined,
            password: url.password || undefined,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            connectTimeout: 3000,
            retryStrategy: (times: number) =>
              times > 3 ? null : Math.min(times * 1000, 2000),
          },
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
