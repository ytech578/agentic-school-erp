import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { PublicAIController } from './public-ai.controller';
import { AIScheduler } from './ai.scheduler';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [AIController, PublicAIController],
  providers: [AIService, AIScheduler, AgentControlPlaneService],
  exports: [AIService, AgentControlPlaneService],
})
export class AIModule {}


