import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIController {
  constructor(private service: AIService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  async chat(
    @Request() req: any,
    @Body() body: { message: string; conversationId?: string },
  ) {
    return this.service.sendMessage({
      userId: req.user.id,
      schoolId: req.user.schoolId,
      user: req.user,
      conversationId: body.conversationId,
      message: body.message,
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List AI conversations' })
  async getConversations(@Request() req: any) {
    return this.service.getConversations(req.user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Param('id') id: string, @Request() req: any) {
    return this.service.getConversation(id, req.user.id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async deleteConversation(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteConversation(id, req.user.id);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI dashboard insights' })
  async getInsights(@Request() req: any) {
    const insights = await this.service.generateDashboardInsights(
      req.user.schoolId,
      req.user,
    );
    return { insights };
  }
}
