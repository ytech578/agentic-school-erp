import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { MarkAttendanceSchema } from '@school-erp/shared';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Get('classes')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getClasses(@Request() req: any) {
    return this.service.getClassesAndSections(req.user.schoolId);
  }

  @Get('students')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudents(
    @Request() req: any,
    @Query('sectionId') sectionId: string,
    @Query('date') date: string,
  ) {
    return this.service.getStudentsForAttendance(req.user.schoolId, sectionId, date);
  }

  @Post('mark')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async markAttendance(@Request() req: any, @Body() body: any) {
    const parsedData = MarkAttendanceSchema.parse(body);
    return this.service.markAttendance(req.user.schoolId, req.user.id, parsedData);
  }
}
