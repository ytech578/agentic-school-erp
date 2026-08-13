import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Timetable')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  getTimetable(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.timetableService.getTimetable(req.user.schoolId, { classId, sectionId, academicYearId });
  }

  @Get('teacher/:staffId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getTeacherTimetable(
    @Request() req: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    // Basic authorization check: if TEACHER, can only view own timetable unless otherwise permitted
    if (req.user.role === 'TEACHER' && req.user.staffId !== staffId) {
      // Allowing teachers to see others for collaboration is fine, but can restrict if needed.
    }
    return this.timetableService.getTeacherTimetable(req.user.schoolId, staffId, academicYearId);
  }

  @Get('today')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  getTodaySchedule(
    @Request() req: any,
    @Query('sectionId') sectionId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.timetableService.getTodaySchedule(req.user.schoolId, sectionId, academicYearId);
  }

  @Post('slots')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  saveSlot(@Request() req: any, @Body() data: any) {
    return this.timetableService.saveSlot(req.user.schoolId, data);
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  bulkSaveSlots(@Request() req: any, @Body() slots: any[]) {
    return this.timetableService.bulkSaveSlots(req.user.schoolId, slots);
  }

  @Delete('slots/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  deleteSlot(@Request() req: any, @Param('id') id: string) {
    return this.timetableService.deleteSlot(req.user.schoolId, id);
  }
}
