import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HRService } from './hr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('HR')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr')
export class HRController {
  constructor(private service: HRService) {}

  // ─── Leave Requests ──────────────────────────────────────────────────────────

  @Post('leaves/apply')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Apply for leave' })
  applyLeave(
    @Request() req: any,
    @Body() body: { leaveType: string; startDate: string; endDate: string; reason: string; staffId?: string },
  ) {
    // Admins can apply on behalf of staff; teachers apply for themselves
    return this.service.applyLeave({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      leaveType: body.leaveType,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    });
  }

  @Get('leaves')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get all leave requests' })
  getLeaves(
    @Request() req: any,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getLeaveRequests(
      req.user.schoolId, 
      { staffId, status }, 
      req.user.role, 
      req.user.id
    );
  }

  @Put('leaves/:id/review')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  reviewLeave(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
  ) {
    return this.service.reviewLeave(req.user.schoolId, id, {
      status: body.status,
      reviewNote: body.reviewNote,
      reviewedBy: req.user.id,
    });
  }

  @Put('leaves/:id/cancel')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Cancel a pending leave request' })
  cancelLeave(@Param('id') id: string, @Request() req: any) {
    return this.service.cancelLeave(req.user.schoolId, id, req.user.id);
  }

  @Get('leaves/summary')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get summary of leave requests' })
  getLeaveSummary(@Request() req: any) {
    return this.service.getLeaveSummary(req.user.schoolId, req.user.role, req.user.id);
  }

  // ─── Staff Attendance ─────────────────────────────────────────────────────────

  @Get('staff-attendance')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get staff attendance report for a date' })
  getStaffAttendance(@Request() req: any, @Query('date') date?: string) {
    return this.service.getStaffAttendanceReport(req.user.schoolId, date);
  }

  @Post('staff-attendance/mark')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Mark a staff member attendance status' })
  markStaffAttendance(
    @Request() req: any,
    @Body() body: { staffId: string; date: string; status: 'PRESENT' | 'ABSENT' },
  ) {
    return this.service.markStaffAttendance(req.user.schoolId, body);
  }

  // ─── Organization & Structure ───────────────────────────────────────────────

  @Get('departments')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get departments with headcount stats' })
  getDepartments(@Request() req: any) {
    return this.service.getDepartmentsWithStats(req.user.schoolId);
  }

  @Post('departments')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create department' })
  createDepartment(@Request() req: any, @Body() body: { name: string; description?: string }) {
    return this.service.createDepartment(req.user.schoolId, body);
  }

  @Get('designations')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get designations with headcount stats' })
  getDesignations(@Request() req: any) {
    return this.service.getDesignationsWithStats(req.user.schoolId);
  }

  @Post('designations')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create designation' })
  createDesignation(@Request() req: any, @Body() body: { name: string }) {
    return this.service.createDesignation(req.user.schoolId, body);
  }

  // ─── Staff Roster ───────────────────────────────────────────────────────────

  @Get('staff')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get staff roster with department & designation filtering' })
  getStaffRoster(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('designationId') designationId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getStaffRoster(req.user.schoolId, {
      departmentId,
      designationId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  // ─── Leave Policy & Entitlement Balances ───────────────────────────────────

  @Get('leaves/balances')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get leave quotas and remaining balances' })
  getLeaveBalances(@Request() req: any) {
    return this.service.getLeaveBalances(req.user.schoolId, req.user.id);
  }
}
