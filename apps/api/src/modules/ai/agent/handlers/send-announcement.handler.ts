import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  SendAnnouncementInput,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class SendAnnouncementAgentHandler implements AgentToolHandler<
  SendAnnouncementInput,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.SEND_ANNOUNCEMENT;
  private readonly logger = new Logger(SendAnnouncementAgentHandler.name);

  constructor(private readonly messagesService: MessagesService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: SendAnnouncementInput,
  ): Promise<AgentHandlerResult> {
    const broadcastResult = await this.messagesService.broadcastAnnouncement({
      schoolId: context.schoolId,
      senderId: context.userId,
      subject: args.title,
      body: args.message ?? 'Sent via AI Assistant.',
    });

    const sentCount = broadcastResult.sent;

    return {
      resourceType: 'Announcement',
      status: 'SENT',
      affectedCount: sentCount,
      sentCount,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: SendAnnouncementInput,
    result: AgentHandlerResult,
  ): Promise<void> {
    const sentCount = (result.sentCount ?? result.affectedCount ?? 0) as number;

    // Step 8: A zero-recipient result must NOT be silently accepted as success
    if (sentCount === 0) {
      this.logger.error(
        'Announcement broadcast failed verification: 0 recipients reached',
      );
      throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
    }

    // Verify expected message count, correct sender, and correct school in database
    const check = await this.messagesService.verifyAnnouncement(
      context.schoolId,
      context.userId,
      args.title,
      sentCount,
    );

    if (!check.verified) {
      throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: SendAnnouncementInput,
  ): Promise<ReconciliationResult> {
    const existing = await this.messagesService.findAnnouncement(
      context.schoolId,
      context.userId,
      args.title,
    );

    if (existing) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'Announcement',
          status: 'SENT',
          affectedCount: 1,
          sentCount: 1,
        },
      };
    }

    return {
      status: 'NOT_APPLIED',
      reason: `No broadcast message found with subject "${args.title}"`,
    };
  }
}
