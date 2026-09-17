import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TOOL_REGISTRY, ToolDefinition } from './tool-registry';
import { AgentExecutionContext, AgentActionResult, AGENT_ERRORS } from './agent-types';
import { AgentActionStatus, Prisma } from '@prisma/client';

@Injectable()
export class AgentControlPlaneService {
  constructor(private readonly prisma: PrismaService) {}

  async proposeAction(
    ctx: AgentExecutionContext,
    toolName: string,
    rawArgs: any,
  ): Promise<{ pendingAction: any }> {
    const tool = TOOL_REGISTRY.get(toolName);
    if (!tool) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
    }

    if (!tool.allowedRoles.includes(ctx.role)) {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_NOT_AUTHORIZED);
    }

    let resolvedArgs = { ...rawArgs };
    let label = `Execute ${tool.description}`;

    // No-guessing identity resolution
    if (toolName === 'approve_leave') {
      const staffName = rawArgs?.staffName?.trim();
      if (!staffName) {
        throw new BadRequestException(AGENT_ERRORS.ACTION_INVALID_ARGUMENTS);
      }
      
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          schoolId: ctx.schoolId,
          status: 'PENDING',
          staff: {
            user: {
              OR: [
                { firstName: { contains: staffName, mode: 'insensitive' } },
                { lastName: { contains: staffName, mode: 'insensitive' } },
              ],
            },
          },
        },
        include: { staff: { include: { user: true } } },
      });

      if (leaves.length === 0) {
        throw new NotFoundException(AGENT_ERRORS.ACTION_RESOURCE_FORBIDDEN);
      }
      if (leaves.length > 1) {
        throw new BadRequestException(AGENT_ERRORS.ACTION_INVALID_ARGUMENTS);
      }

      const leave = leaves[0];
      resolvedArgs = { leaveId: leave.id };
      label = `Approve leave for ${leave.staff.user.firstName} ${leave.staff.user.lastName}`;
    }

    if (toolName === 'create_assignment') {
      const className = rawArgs?.className?.trim();
      if (!className) {
        throw new BadRequestException(AGENT_ERRORS.ACTION_INVALID_ARGUMENTS);
      }

      const foundClass = await this.prisma.class.findFirst({
        where: { name: className, schoolId: ctx.schoolId },
      });

      if (!foundClass) {
        throw new NotFoundException(AGENT_ERRORS.ACTION_RESOURCE_FORBIDDEN);
      }
      resolvedArgs.classId = foundClass.id;
      label = `Create assignment for ${foundClass.name}`;
    }

    // Default expiry 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const action = await this.prisma.agentAction.create({
      data: {
        schoolId: ctx.schoolId,
        userId: ctx.userId,
        toolName: tool.name,
        arguments: resolvedArgs as Prisma.InputJsonValue,
        riskLevel: tool.riskLevel,
        status: tool.requiresConfirmation ? AgentActionStatus.AWAITING_CONFIRMATION : AgentActionStatus.CONFIRMED,
        requiresConfirmation: tool.requiresConfirmation,
        label,
        expiresAt,
      },
    });

    return {
      pendingAction: {
        actionId: action.id,
        type: tool.name,
        label: action.label,
        riskLevel: action.riskLevel,
        status: action.status,
        expiresAt: action.expiresAt,
        requiresConfirmation: action.requiresConfirmation,
        data: resolvedArgs,
      },
    };
  }

  async confirmAndExecute(
    actionId: string,
    userId: string,
    schoolId: string,
  ): Promise<AgentActionResult> {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
    }

    if (action.userId !== userId || action.schoolId !== schoolId) {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
    }

    if (action.status !== AgentActionStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException('Invalid state transition');
    }

    if (action.expiresAt && action.expiresAt < new Date()) {
      throw new BadRequestException(AGENT_ERRORS.ACTION_EXPIRED);
    }

    const tool = TOOL_REGISTRY.get(action.toolName);
    if (!tool) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
    }

    // Re-authorize role
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !tool.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_NOT_AUTHORIZED);
    }

    // Atomic CAS
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.agentAction.updateMany({
        where: { id: actionId, status: AgentActionStatus.AWAITING_CONFIRMATION },
        data: { 
          status: AgentActionStatus.EXECUTING, 
          executedAt: new Date(),
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException(AGENT_ERRORS.ACTION_ALREADY_EXECUTED);
      }
      return result;
    });

    try {
      const args = action.arguments as any;
      let resultData: any = null;

      // Tool Handlers
      switch (action.toolName) {
        case 'approve_leave':
          resultData = await this.handleApproveLeave(args, userId, schoolId);
          break;
        case 'create_assignment':
          resultData = await this.handleCreateAssignment(args, userId, schoolId);
          break;
        case 'send_announcement':
          resultData = await this.handleSendAnnouncement(args, userId, schoolId);
          break;
        case 'automation_fee_defaulter':
        case 'automation_absence_alert':
        case 'automation_timetable_cover':
        case 'automation_attendance_warning':
        case 'automation_leave_recommendation':
        case 'automation_report_card_publish':
        case 'automation_daily_digest':
          resultData = { executed: true, automationType: action.toolName };
          break;
        default:
          throw new Error('Handler not implemented');
      }

      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.SUCCEEDED,
          result: resultData as Prisma.InputJsonValue,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          schoolId,
          userId,
          action: 'UPDATE',
          module: 'AI_CONTROL_PLANE',
          resourceId: actionId,
          resourceType: 'AgentAction',
          description: action.label,
          after: { actionId, toolName: action.toolName, riskLevel: action.riskLevel, status: 'SUCCEEDED' },
        },
      });

      return {
        actionId,
        status: AgentActionStatus.SUCCEEDED,
        result: resultData,
      };
    } catch (error: any) {
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.FAILED,
          failureReason: error.message,
        },
      });

      return {
        actionId,
        status: AgentActionStatus.FAILED,
        failureReason: error.message,
      };
    }
  }

  private async handleApproveLeave(args: any, userId: string, schoolId: string) {
    if (!args.leaveId) throw new Error('Missing leaveId');
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: args.leaveId },
    });
    if (!leave || leave.schoolId !== schoolId) throw new Error(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
    
    const updated = await this.prisma.leaveRequest.update({
      where: { id: args.leaveId },
      data: {
        status: 'APPROVED',
        reviewedBy: userId,
        reviewNote: `[Approved via AI Assistant] ${args.reason || ''}`.trim(),
      },
    });

    await this.prisma.activityLog.create({
      data: {
        schoolId,
        userId,
        action: 'UPDATE',
        module: 'AI_AGENT',
        resourceType: 'LeaveRequest',
        resourceId: updated.id,
        description: `Leave request for ${updated.staffId} approved via AI by ${userId}`,
      },
    });

    return updated;
  }

  private async handleCreateAssignment(args: any, userId: string, schoolId: string) {
    if (!args.classId) throw new Error('Missing classId');

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!academicYear) throw new Error('No active academic year found');

    const staff = await this.prisma.staff.findFirst({
      where: { userId, schoolId, isActive: true },
    });
    if (!staff) throw new Error('Teacher profile not found');

    const subject = await this.prisma.subject.findFirst({
      where: { schoolId },
    });
    if (!subject) throw new Error('No subjects found');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // Default 7 days

    const assignment = await this.prisma.assignment.create({
      data: {
        schoolId,
        title: args.topic || 'New Assignment',
        description: args.description || 'Generated by AI Assistant',
        dueDate,
        academicYearId: academicYear.id,
        classId: args.classId,
        subjectId: subject.id,
        staffId: staff.id,
        maxMarks: args.totalMarks || 100,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        schoolId,
        userId,
        action: 'CREATE',
        module: 'AI_AGENT',
        resourceType: 'Assignment',
        resourceId: assignment.id,
        description: `Assignment created via AI by ${userId}`,
      },
    });

    return assignment;
  }

  private async handleSendAnnouncement(args: any, userId: string, schoolId: string) {
    const allUsers = await this.prisma.user.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true },
    });
    const recipients = allUsers.filter((u) => u.id !== userId);

    if (recipients.length > 0) {
      await this.prisma.message.createMany({
        data: recipients.map((r) => ({
          schoolId,
          senderId: userId,
          recipientId: r.id,
          subject: args.title || 'Important Announcement',
          body: args.message || 'Generated via AI Assistant.',
        })),
      });

      await this.prisma.activityLog.create({
        data: {
          schoolId,
          userId,
          action: 'CREATE',
          module: 'AI_AGENT',
          resourceType: 'Message',
          description: `Broadcast announcement sent via AI by ${userId}`,
        },
      });
    }

    return { sentCount: recipients.length };
  }

  async expireStaleActions() {
    return this.prisma.agentAction.updateMany({
      where: {
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AgentActionStatus.EXPIRED,
      },
    });
  }
}
