import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AIService } from './ai.service';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('AI')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AIController {
  constructor(
    private service: AIService,
    private controlPlane: AgentControlPlaneService,
  ) {}

  // ─── Chat ─────────────────────────────────────────────────────────────────
  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  async chat(
    @Request() req: any,
    @Body() body: {
      message: string;
      conversationId?: string;
      attachments?: Array<{ name: string; type: string; size: number; base64: string }>;
    },
  ) {
    return this.service.sendMessage({
      userId: req.user.id,
      schoolId: req.user.schoolId,
      user: req.user,
      conversationId: body.conversationId,
      message: body.message,
      attachments: body.attachments,
    });
  }

  // ─── Action Confirmation ──────────────────────────────────────────────────
  @Post('action/:id/confirm')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Confirm and execute a proposed AI action' })
  async confirmAction(@Param('id') id: string, @Request() req: any) {
    // Server-authoritative: userId and schoolId from JWT — never from body
    return this.controlPlane.confirmAndExecute(id, req.user.id, req.user.schoolId);
  }

  // ─── Action Status (Phase 15) ─────────────────────────────────────────────
  @Get('action/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get status of an AI agent action' })
  async getActionStatus(@Param('id') id: string, @Request() req: any) {
    // Tenant-isolated: server validates ownership inside service
    return this.controlPlane.getActionStatus(id, req.user.id, req.user.schoolId);
  }

  // ─── Alerts ───────────────────────────────────────────────────────────────
  @Post('alerts/run-monitoring')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Trigger proactive monitoring' })
  async runMonitoring(@Request() req: any) {
    await this.service.runProactiveMonitoring(req.user.schoolId);
    return { success: true, message: 'Monitoring complete.' };
  }

  @Get('alerts')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get proactive agent alerts' })
  async getAlerts(@Request() req: any) {
    return this.service.getProactiveAlerts(req.user.schoolId);
  }

  @Patch('alerts/read-all')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllAlertsRead(req.user.schoolId);
  }

  @Patch('alerts/:id/read')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Mark an alert as read' })
  async markAlertRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markAlertRead(id, req.user.schoolId);
  }

  // ─── Admission Workflow ───────────────────────────────────────────────────
  @Post('admissions/:id/workflow')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Run multi-agent admission workflow' })
  async runAdmissionWorkflow(@Param('id') id: string, @Request() req: any) {
    return this.service.runAdmissionWorkflow(id, req.user.schoolId);
  }

  // ─── Conversations ─────────────────────────────────────────────────────────
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

  // ─── Insights ─────────────────────────────────────────────────────────────
  @Get('insights')
  @ApiOperation({ summary: 'Get AI dashboard insights' })
  async getInsights(@Request() req: any) {
    const insights = await this.service.generateDashboardInsights(req.user.schoolId, req.user);
    return { insights };
  }

  // ─── Automation Preview (READ-ONLY) ───────────────────────────────────────
  @Get('automation/preview/:taskType')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Preview an automation task (read-only — no mutations)' })
  async previewAutomation(@Param('taskType') taskType: string, @Request() req: any) {
    const { schoolId } = req.user;
    switch (taskType) {
      case 'FEE_DEFAULTER':        return this.service.generateFeeDefaulterPreview(schoolId);
      case 'ABSENCE_ALERT':        return this.service.generateAbsenceAlertPreview(schoolId);
      case 'TIMETABLE_COVER':      return this.service.generateTimetableCoverPreview(schoolId);
      case 'ATTENDANCE_WARNING':   return this.service.generateAttendanceWarningPreview(schoolId);
      case 'LEAVE_RECOMMENDATION': return this.service.generateLeaveAIRecommendationPreview(schoolId);
      case 'REPORT_CARD_PUBLISH':  return this.service.generateReportCardPublishPreview(schoolId);
      case 'DAILY_DIGEST':         return this.service.generateDailyDigestPreview(schoolId);
      default: return { error: 'Unknown task type' };
    }
  }

  /**
   * PHASE 4 — BYPASS ELIMINATION
   *
   * POST /ai/automation/execute is NO LONGER a direct mutation path.
   * All automation executions now go through the Agentic Control Plane
   * via proposeAction → confirmation lifecycle.
   *
   * The client must:
   *   1. Call GET /ai/automation/preview/:taskType  (read-only)
   *   2. POST /ai/automation/execute (creates AgentAction proposal)
   *   3. POST /ai/action/:id/confirm (executes with full authorization chain)
   */
  @Post('automation/execute')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Propose an automation task via the Agentic Control Plane' })
  async executeAutomation(
    @Body() body: { taskType: string; payload: { items?: unknown[]; subject?: string } },
    @Request() req: any,
  ) {
    // Map taskType → tool name
    const toolNameMap: Record<string, string> = {
      FEE_DEFAULTER:        'automation_fee_defaulter',
      ABSENCE_ALERT:        'automation_absence_alert',
      TIMETABLE_COVER:      'automation_timetable_cover',
      ATTENDANCE_WARNING:   'automation_attendance_warning',
      LEAVE_RECOMMENDATION: 'automation_leave_recommendation',
      REPORT_CARD_PUBLISH:  'automation_report_card_publish',
      DAILY_DIGEST:         'automation_daily_digest',
    };

    const toolName = toolNameMap[body.taskType];
    if (!toolName) {
      throw new BadRequestException(`Unknown automation taskType: "${body.taskType}"`);
    }

    // All mutations go through the control plane
    const ctx = {
      userId: req.user.id,
      role: req.user.role,   // server-resolved from JWT
      schoolId: req.user.schoolId,
    };

    const proposal = await this.controlPlane.proposeAction(ctx, toolName, {
      items: body.payload?.items,
      subject: body.payload?.subject,
    });

    return proposal;
  }

  // ─── AI Copilot ───────────────────────────────────────────────────────────
  @Post('copilot/lesson-plan')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Generate a structured lesson plan with TLM kit and curriculum alignment' })
  async generateLessonPlan(
    @Body()
    body: {
      topic: string;
      grade: string;
      duration: string;
      subject?: string;
      includeTlm?: boolean;
      curriculum?: string;
    },
  ) {
    const result = await this.service.generateLessonPlan(body.topic, body.grade, body.duration, {
      subject: body.subject,
      includeTlm: body.includeTlm !== false,
      curriculum: body.curriculum,
    });
    return { result };
  }

  @Post('copilot/remark')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Generate a student remark' })
  async generateRemark(@Body() body: { studentProfile: string; tone: string }) {
    const result = await this.service.generateStudentRemark(body.studentProfile, body.tone);
    return { result };
  }

  @Post('copilot/parent-update')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Generate a parent update' })
  async generateParentUpdate(@Body() body: { studentProfile: string; context: string }) {
    const result = await this.service.generateParentUpdate(body.studentProfile, body.context);
    return { result };
  }

  // ─── Data Query ───────────────────────────────────────────────────────────
  @Post('query')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Execute a natural language data query with optional multimodal attachments' })
  async executeDataQuery(
    @Body()
    body: {
      prompt: string;
      attachments?: Array<{ name: string; type: string; size: number; base64: string }>;
    },
    @Request() req: any,
  ) {
    const result = await this.service.executeDataQuery(
      req.user.schoolId,
      body.prompt,
      req.user.id,
      body.attachments,
    );
    return { result };
  }

  // ─── Anomalies ────────────────────────────────────────────────────────────
  @Get('anomalies')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get school anomalies' })
  async getAnomalies(@Request() req: any) {
    const anomalies = await this.service.getSchoolAnomalies(req.user.schoolId);
    return { anomalies };
  }

  // ─── Question Paper ───────────────────────────────────────────────────────
  @Post('copilot/question-paper')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Generate a structured question paper and marking scheme' })
  async generateQuestionPaper(
    @Body()
    body: {
      grade: string;
      subject: string;
      totalMarks?: number;
      duration?: string;
      difficulty?: string;
      topics?: string;
      includeAnswerKey?: boolean;
      board?: string;
      schoolName?: string;
    },
    @Request() req: any,
  ) {
    const result = await this.service.generateQuestionPaper(req.user.schoolId, body);
    return { result };
  }

  // ─── Retention / MTSS ────────────────────────────────────────────────────
  @Get('retention/early-warning')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get predictive early-warning retention risk students' })
  async getEarlyWarningRiskStudents(
    @Query('classId') classId?: string,
    @Query('riskLevel') riskLevel?: string,
    @Request() req?: any,
  ) {
    return this.service.getEarlyWarningRiskStudents(req.user.schoolId, { classId, riskLevel });
  }

  @Post('retention/intervention-plan')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Generate individualized MTSS intervention plan for a student' })
  async generateInterventionPlan(
    @Body() body: { studentId: string },
    @Request() req: any,
  ) {
    return this.service.generateStudentInterventionPlan(req.user.schoolId, body.studentId);
  }

  // ─── Helpdesk ─────────────────────────────────────────────────────────────
  @Post('helpdesk/chat')
  @ApiOperation({ summary: '24/7 Multilingual Admissions Concierge & Tour Guide Chat' })
  async chatHelpdesk(
    @Body()
    body: {
      message: string;
      language?: string;
      sessionId?: string;
      parentName?: string;
      phone?: string;
      email?: string;
      classApplied?: string;
      studentName?: string;
    },
    @Request() req: any,
  ) {
    return this.service.chatHelpdesk(req.user.schoolId, body);
  }

  // ─── Student Remedial ─────────────────────────────────────────────────────
  @Get('student/remedial')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get personalized student academic remedial plan & learning gaps' })
  async getStudentRemedialPlan(@Request() req: any) {
    return this.service.getStudentRemedialPlan(req.user.schoolId, req.user.id);
  }

  @Post('student/practice')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Generate adaptive diagnostic practice questions for a topic' })
  async generateAdaptivePractice(
    @Body() body: { subject: string; topic: string },
    @Request() req: any,
  ) {
    return this.service.generateAdaptivePractice(
      req.user.schoolId,
      req.user.id,
      body.subject,
      body.topic,
    );
  }
}
