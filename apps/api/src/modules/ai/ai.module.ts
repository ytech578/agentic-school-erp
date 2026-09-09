import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { AIScheduler } from './ai.scheduler';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [AIController],
  providers: [AIService, AIScheduler],
  exports: [AIService],
})
export class AIModule {}


