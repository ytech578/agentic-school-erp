import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { PublicAIController } from './public-ai.controller';
import { AIScheduler } from './ai.scheduler';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';
import { AgentPolicyService } from './agent/agent-policy.service';
import { AgentToolDispatcher } from './agent/agent-tool-dispatcher';
import {
  AGENT_TOOL_HANDLERS,
  AgentToolHandler,
  ApproveLeaveAgentHandler,
  CreateAssignmentAgentHandler,
  SendAnnouncementAgentHandler,
  AutomationFeeDefaulterHandler,
  AutomationAbsenceAlertHandler,
  AutomationAttendanceWarningHandler,
  AutomationTimetableCoverHandler,
  AutomationLeaveRecommendationHandler,
  AutomationReportCardPublishHandler,
  AutomationDailyDigestHandler,
} from './agent/handlers';
import { HRModule } from '../hr/hr.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { MessagesModule } from '../messages/messages.module';
import { TimetableModule } from '../timetable/timetable.module';

const TOOL_HANDLERS = [
  ApproveLeaveAgentHandler,
  CreateAssignmentAgentHandler,
  SendAnnouncementAgentHandler,
  AutomationFeeDefaulterHandler,
  AutomationAbsenceAlertHandler,
  AutomationAttendanceWarningHandler,
  AutomationTimetableCoverHandler,
  AutomationLeaveRecommendationHandler,
  AutomationReportCardPublishHandler,
  AutomationDailyDigestHandler,
];

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    HRModule,
    AssignmentsModule,
    MessagesModule,
    TimetableModule,
  ],
  controllers: [AIController, PublicAIController],
  providers: [
    AIService,
    AIScheduler,
    AgentControlPlaneService,
    AgentPolicyService,
    AgentToolDispatcher,
    ...TOOL_HANDLERS,
    {
      provide: AGENT_TOOL_HANDLERS,
      useFactory: (...handlers: AgentToolHandler[]) => handlers,
      inject: TOOL_HANDLERS,
    },
  ],
  exports: [AIService, AgentControlPlaneService, AgentToolDispatcher],
})
export class AIModule {}
