import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
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
  async chat(@Request() req: any, @Body() body: { message: string; conversationId?: string }) {
    return this.service.sendMessage({
      userId: req.user.id,
      schoolId: req.user.schoolId,
      user: req.user,
      conversationId: body.conversationId,
      message: body.message,
    });
  }

  @Post('action/execute')
  @ApiOperation({ summary: 'Execute a confirmed AI action' })
  async executeAction(@Request() req: any, @Body() body: { type: string; data: any }) {
    return this.service.executeAIAction(req.user.schoolId, req.user.id, body);
  }

  @Post('alerts/run-monitoring')
  @ApiOperation({ summary: 'Trigger proactive monitoring' })
  async runMonitoring(@Request() req: any) {
    await this.service.runProactiveMonitoring(req.user.schoolId);
    return { success: true, message: 'Monitoring complete.' };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get proactive agent alerts' })
  async getAlerts(@Request() req: any) {
    return this.service.getProactiveAlerts(req.user.schoolId);
  }

  @Patch('alerts/read-all')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllAlertsRead(req.user.schoolId);
  }

  @Patch('alerts/:id/read')
  @ApiOperation({ summary: 'Mark an alert as read' })
  async markAlertRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markAlertRead(id, req.user.schoolId);
  }

  @Post('admissions/:id/workflow')
  @ApiOperation({ summary: 'Run multi-agent admission workflow' })
  async runAdmissionWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.service.runAdmissionWorkflow(id, req.user.schoolId);
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
    const insights = await this.service.generateDashboardInsights(req.user.schoolId, req.user);
    return { insights };
  }

  @Get('automation/preview/:taskType')
  @ApiOperation({ summary: 'Preview an automation task' })
  async previewAutomation(@Param('taskType') taskType: string, @Request() req: any) {
    const { schoolId } = req.user;
    switch (taskType) {
      case 'FEE_DEFAULTER': return this.service.generateFeeDefaulterPreview(schoolId);
      case 'ABSENCE_ALERT': return this.service.generateAbsenceAlertPreview(schoolId);
      case 'TIMETABLE_COVER': return this.service.generateTimetableCoverPreview(schoolId);
      case 'ATTENDANCE_WARNING': return this.service.generateAttendanceWarningPreview(schoolId);
      case 'LEAVE_RECOMMENDATION': return this.service.generateLeaveAIRecommendationPreview(schoolId);
      case 'REPORT_CARD_PUBLISH': return this.service.generateReportCardPublishPreview(schoolId);
      case 'DAILY_DIGEST': return this.service.generateDailyDigestPreview(schoolId);
      default: return { error: 'Unknown task type' };
    }
  }

  @Post('automation/execute')
  @ApiOperation({ summary: 'Execute a confirmed automation task' })
  async executeAutomation(@Body() body: { taskType: string; payload: any }, @Request() req: any) {
    return this.service.executeAutomationTask(req.user.schoolId, req.user.id, body.taskType, body.payload);
  }

  @Post('copilot/lesson-plan')
  @ApiOperation({ summary: 'Generate a lesson plan' })
  async generateLessonPlan(@Body() body: { topic: string; grade: string; duration: string }) {
    const result = await this.service.generateLessonPlan(body.topic, body.grade, body.duration);
    return { result };
  }

  @Post('copilot/remark')
  @ApiOperation({ summary: 'Generate a student remark' })
  async generateRemark(@Body() body: { studentProfile: string; tone: string }) {
    const result = await this.service.generateStudentRemark(body.studentProfile, body.tone);
    return { result };
  }

  @Post('copilot/parent-update')
  @ApiOperation({ summary: 'Generate a parent update' })
  async generateParentUpdate(@Body() body: { studentProfile: string; context: string }) {
    const result = await this.service.generateParentUpdate(body.studentProfile, body.context);
    return { result };
  }

  @Post('query')
  @ApiOperation({ summary: 'Execute a natural language data query' })
  async executeDataQuery(@Body() body: { prompt: string }, @Request() req: any) {
    const result = await this.service.executeDataQuery(req.user.schoolId, body.prompt, req.user.id);
    return { result };
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Get school anomalies' })
  async getAnomalies(@Request() req: any) {
    const anomalies = await this.service.getSchoolAnomalies(req.user.schoolId);
    return { anomalies };
  }
}
