import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Exams')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exams')
export class ExamsController {
  constructor(private service: ExamsService) {}

  // ─── Subjects Master ─────────────────────────────────────────────────────
  @Get('subjects')
  @ApiOperation({ summary: 'Get all subjects for school' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getSubjects(@Request() req: any) {
    return this.service.getSubjects(req.user.schoolId);
  }

  // ─── Create Exam ─────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Create exam' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createExam(@Request() req: any, @Body() body: any) {
    return this.service.createExam(req.user.schoolId, body);
  }

  // ─── List Exams ──────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List exams' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async listExams(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.listExams(req.user.schoolId, academicYearId);
  }

  // ─── Get Exam ─────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get exam detail' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getExam(@Request() req: any, @Param('id') id: string) {
    return this.service.getExam(req.user.schoolId, id);
  }

  // ─── Add Subject to Exam ─────────────────────────────────────────────────
  @Post(':id/subjects')
  @ApiOperation({ summary: 'Add subject to exam' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async addExamSubject(
    @Request() req: any,
    @Param('id') examId: string,
    @Body() body: any,
  ) {
    return this.service.addExamSubject(examId, req.user.schoolId, body);
  }

  // ─── Enter Marks ─────────────────────────────────────────────────────────
  @Post(':id/subjects/:examSubjectId/marks')
  @ApiOperation({ summary: 'Enter marks for an exam subject' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async enterMarks(
    @Request() req: any,
    @Param('id') _examId: string,
    @Param('examSubjectId') examSubjectId: string,
    @Body() body: { marks: any[] },
  ) {
    return this.service.enterMarks(
      examSubjectId,
      req.user.schoolId,
      body.marks,
      req.user.id,
    );
  }

  // ─── Get Marks for Subject ────────────────────────────────────────────────
  @Get(':id/subjects/:examSubjectId/marks')
  @ApiOperation({ summary: 'Get marks for an exam subject' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getMarks(
    @Request() req: any,
    @Param('examSubjectId') examSubjectId: string,
  ) {
    return this.service.getMarksForSubject(examSubjectId, req.user.schoolId);
  }

  // ─── Students for Marks Entry ─────────────────────────────────────────────
  @Get(':id/subjects/:examSubjectId/students')
  @ApiOperation({ summary: 'Get students for marks entry' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudentsForMarks(
    @Request() req: any,
    @Param('examSubjectId') examSubjectId: string,
    @Query('sectionId') sectionId: string,
  ) {
    return this.service.getStudentsForMarksEntry(
      examSubjectId,
      sectionId,
      req.user.schoolId,
    );
  }

  // ─── Generate Report Cards ────────────────────────────────────────────────
  @Post(':id/report-cards')
  @ApiOperation({ summary: 'Generate report cards for exam' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async generateReportCards(@Request() req: any, @Param('id') examId: string) {
    return this.service.generateReportCards(examId, req.user.schoolId);
  }

  // ─── Get Class Results ────────────────────────────────────────────────────
  @Get(':id/results')
  @ApiOperation({ summary: 'Get class results / leaderboard' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getClassResults(@Request() req: any, @Param('id') examId: string) {
    return this.service.getClassResults(examId, req.user.schoolId);
  }

  // ─── Get Student Report Card ──────────────────────────────────────────────
  @Get(':id/results/:studentId')
  @ApiOperation({ summary: 'Get report card for a student' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  async getStudentReportCard(
    @Request() req: any,
    @Param('id') examId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.service.getStudentReportCard(examId, studentId, req.user.schoolId);
  }

  // ─── Publish Results ──────────────────────────────────────────────────────
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish exam results' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async publishResults(@Request() req: any, @Param('id') examId: string) {
    return this.service.publishResults(examId, req.user.schoolId);
  }

  // ─── Student Results (all exams) ──────────────────────────────────────────
  @Get('student/:studentId/results')
  @ApiOperation({ summary: 'Get all results for a student' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  async getStudentResults(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.service.getStudentResults(studentId, req.user.schoolId);
  }
}
