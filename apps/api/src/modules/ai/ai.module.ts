import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { PublicAIController } from './public-ai.controller';
import { AIScheduler } from './ai.scheduler';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';
import { AgentPolicyService } from './agent/agent-policy.service';
import { HRModule } from '../hr/hr.module';
import { AssignmentsModule } from '../assignments/assignments.module';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), HRModule, AssignmentsModule],
  controllers: [AIController, PublicAIController],
  providers: [AIService, AIScheduler, AgentControlPlaneService, AgentPolicyService],
  exports: [AIService, AgentControlPlaneService],
})
export class AIModule {}
