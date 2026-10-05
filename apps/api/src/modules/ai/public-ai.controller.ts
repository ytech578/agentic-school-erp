import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AIService } from './ai.service';

@ApiTags('Public AI Helpdesk')
@Controller('public/helpdesk')
export class PublicAIController {
  constructor(private aiService: AIService) {}

  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public 24/7 Admissions Concierge & Tour Guide Chat',
  })
  @ApiResponse({ status: 200, description: 'AI chat response' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing or invalid schoolId',
  })
  async chatPublicHelpdesk(
    @Body()
    body: {
      schoolId: string;
      message: string;
      language?: string;
      sessionId?: string;
      parentName?: string;
      phone?: string;
      email?: string;
      classApplied?: string;
      studentName?: string;
    },
  ) {
    if (
      !body.schoolId ||
      typeof body.schoolId !== 'string' ||
      body.schoolId.trim().length === 0
    ) {
      throw new BadRequestException(
        'School ID is mandatory for AI admissions concierge (fail-closed)',
      );
    }

    return this.aiService.chatHelpdesk(body.schoolId.trim(), body);
  }
}
