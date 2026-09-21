import { Injectable } from '@nestjs/common';
import { HRService } from '../../../hr/hr.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

export interface ApproveLeaveArgs {
  leaveId: string;
  reason?: string;
}

@Injectable()
export class ApproveLeaveAgentHandler implements AgentToolHandler<
  ApproveLeaveArgs,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.APPROVE_LEAVE;

  constructor(
    private readonly hrService: HRService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    context: AgentToolExecutionContext,
    args: ApproveLeaveArgs,
  ): Promise<AgentHandlerResult> {
    const reviewNote =
      `[Approved via AI Assistant] ${args.reason ?? ''}`.trim();

    // Delegate business mutation to domain service HRService
    const domainResult = await this.hrService.approveLeaveRequest(
      context.schoolId,
      args.leaveId,
      {
        reviewedBy: context.userId,
        reviewNote,
      },
    );

    return {
      resourceId: args.leaveId,
      resourceType: 'LeaveRequest',
      status: 'APPROVED',
      leaveId: args.leaveId,
      approved: domainResult.approved,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: ApproveLeaveArgs,
    _result: AgentHandlerResult,
  ): Promise<void> {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: args.leaveId },
    });

    if (
      !leave ||
      leave.schoolId !== context.schoolId ||
      leave.status !== 'APPROVED' ||
      leave.reviewedBy !== context.userId
    ) {
      throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
    }
  }
}
