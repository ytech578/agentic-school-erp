import { Injectable } from '@nestjs/common';
import { HRService } from '../../../hr/hr.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  ReconciliationResult,
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

  constructor(private readonly hrService: HRService) {}

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
    result?: AgentHandlerResult,
  ): Promise<void> {
    void result;
    const check = await this.hrService.verifyLeaveApproval(
      context.schoolId,
      args.leaveId,
      context.userId,
    );

    if (!check.verified) {
      throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: ApproveLeaveArgs,
  ): Promise<ReconciliationResult> {
    const leave = await this.hrService.getLeaveRequestById(
      context.schoolId,
      args.leaveId,
    );

    if (!leave) {
      return {
        status: 'UNKNOWN',
        reason: `Leave request ${args.leaveId} not found or tenant mismatch`,
      };
    }

    if (leave.status === 'APPROVED') {
      return {
        status: 'APPLIED',
        result: {
          resourceId: args.leaveId,
          resourceType: 'LeaveRequest',
          status: 'APPROVED',
          leaveId: args.leaveId,
          approved: true,
        },
      };
    }

    if (leave.status === 'PENDING') {
      return {
        status: 'NOT_APPLIED',
        reason: 'Leave request is still in PENDING status in the database',
      };
    }

    return {
      status: 'UNKNOWN',
      reason: `Leave request status is ${leave.status}, neither APPROVED nor PENDING`,
    };
  }
}
