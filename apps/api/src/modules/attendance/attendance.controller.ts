import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { MarkAttendanceSchema } from '@school-erp/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Get('classes')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getClasses(@Request() req: any) {
    return this.service.getClassesAndSections(req.user.schoolId);
  }

  @Get('students')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudents(
    @Request() req: any,
    @Query('sectionId') sectionId: string,
    @Query('date') date: string,
  ) {
    return this.service.getStudentsForAttendance(
      req.user.schoolId,
      sectionId,
      date,
    );
  }

  @Post('mark')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @UsePipes(new ZodValidationPipe(MarkAttendanceSchema as any))
  async markAttendance(@Request() req: any, @Body() parsedData: any) {
    return this.service.markAttendance(
      req.user.schoolId,
      req.user.id,
      req.user.role,
      parsedData,
    );
  }

  @Post('hardware-punch')
  async hardwarePunch(
    @Body()
    body: {
      deviceId: string;
      cardId: string;
      timestamp?: string;
      scanType?: 'IN' | 'OUT' | 'PUNCH';
      schoolId?: string;
    },
    @Request() req: any,
  ) {
    return this.service.handleHardwarePunch({
      deviceId: body.deviceId,
      cardId: body.cardId,
      timestamp: body.timestamp,
      scanType: body.scanType,
      schoolId: body.schoolId || req.user?.schoolId,
    });
  }
}
