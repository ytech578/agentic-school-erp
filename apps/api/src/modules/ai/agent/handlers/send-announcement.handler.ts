import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AgentHandlerResult,
  SendAnnouncementInput,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class SendAnnouncementAgentHandler
  implements AgentToolHandler<SendAnnouncementInput, AgentHandlerResult>
{
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
    _context: AgentToolExecutionContext,
    _args: SendAnnouncementInput,
    result: AgentHandlerResult,
  ): Promise<void> {
    const sentCount = (result.sentCount ?? result.affectedCount ?? 0) as number;
    if (sentCount === 0) {
      this.logger.warn(
        'Announcement sent to 0 recipients — no active users found',
      );
    }
  }
}
