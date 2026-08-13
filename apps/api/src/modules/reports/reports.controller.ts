import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/daily')
  getDailyAttendance(@Request() req: any, @Query('date') date?: string) {
    return this.reportsService.getDailyAttendance(req.user.schoolId, date);
  }

  @Get('attendance/register')
  getAttendanceRegister(
    @Request() req: any,
    @Query('sectionId') sectionId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.reportsService.getAttendanceRegister(req.user.schoolId, sectionId, +month, +year);
  }

  @Get('attendance/low')
  getLowAttendance(
    @Request() req: any,
    @Query('threshold') threshold?: string,
  ) {
    return this.reportsService.getLowAttendanceStudents(req.user.schoolId, threshold ? +threshold : 75);
  }

  @Get('fees/collection')
  getFeeCollection(
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getFeeCollectionSummary(req.user.schoolId, from, to);
  }

  @Get('fees/outstanding')
  getFeeOutstanding(@Request() req: any) {
    return this.reportsService.getFeeOutstanding(req.user.schoolId);
  }

  @Get('exams/:examId')
  getExamReport(
    @Request() req: any,
    @Param('examId') examId: string,
    @Query('classId') classId?: string,
  ) {
    return this.reportsService.getExamReport(req.user.schoolId, examId, classId);
  }

  @Get('report-cards/:studentId')
  getReportCard(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('examId') examId?: string,
  ) {
    return this.reportsService.getReportCard(req.user.schoolId, studentId, examId);
  }
}
