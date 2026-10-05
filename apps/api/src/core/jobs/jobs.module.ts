import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Parse the redis URL (e.g. redis://localhost:6379)
        const redisUrl = configService.get<string>(
          'redis.url',
          'redis://localhost:6379',
        );
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            username: url.username || undefined,
            password: url.password || undefined,
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
    // Example Queues
    BullModule.registerQueue({
      name: 'pdf-generation',
    }),
    BullModule.registerQueue({
      name: 'bulk-notifications',
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
