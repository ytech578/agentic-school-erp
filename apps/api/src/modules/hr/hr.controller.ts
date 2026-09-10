import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HRService } from './hr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('HR')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HRController {
  constructor(private service: HRService) {}

  // ─── Leave Requests ──────────────────────────────────────────────────────────

  @Post('leaves/apply')
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
  @ApiOperation({ summary: 'Cancel a pending leave request' })
  cancelLeave(@Param('id') id: string, @Request() req: any) {
    return this.service.cancelLeave(req.user.schoolId, id, req.user.id);
  }

  @Get('leaves/summary')
  @ApiOperation({ summary: 'Get summary of leave requests' })
  getLeaveSummary(@Request() req: any) {
    return this.service.getLeaveSummary(req.user.schoolId, req.user.role, req.user.id);
  }

  // ─── Staff Attendance ─────────────────────────────────────────────────────────

  @Get('staff-attendance')
  @ApiOperation({ summary: 'Get staff attendance report for a date' })
  getStaffAttendance(@Request() req: any, @Query('date') date?: string) {
    return this.service.getStaffAttendanceReport(req.user.schoolId, date);
  }

  @Post('staff-attendance/mark')
  @ApiOperation({ summary: 'Mark a staff member attendance status' })
  markStaffAttendance(
    @Request() req: any,
    @Body() body: { staffId: string; date: string; status: 'PRESENT' | 'ABSENT' },
  ) {
    return this.service.markStaffAttendance(req.user.schoolId, body);
  }
}
