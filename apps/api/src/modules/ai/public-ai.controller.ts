import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { PrismaService } from '../../core/database/prisma.service';

@ApiTags('Public AI Helpdesk')
@Controller('public/helpdesk')
export class PublicAIController {
  constructor(
    private aiService: AIService,
    private prisma: PrismaService,
  ) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Public 24/7 Admissions Concierge & Tour Guide Chat',
  })
  async chatPublicHelpdesk(
    @Body()
    body: {
      schoolId?: string;
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
    let resolvedSchoolId = body.schoolId;
    if (!resolvedSchoolId) {
      const defaultSchool = await this.prisma.school.findFirst({
        select: { id: true },
      });
      if (!defaultSchool) {
        throw new BadRequestException('No school registered in ERP system.');
      }
      resolvedSchoolId = defaultSchool.id;
    }

    return this.aiService.chatHelpdesk(resolvedSchoolId, body);
  }
}
