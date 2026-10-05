import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PtmService } from './ptm.service';
import {
  CreatePtmSessionDto,
  BookPtmSlotDto,
  CompletePtmSlotDto,
} from './dto/ptm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('PTM')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ptm')
export class PtmController {
  constructor(private readonly ptmService: PtmService) {}

  @Post('sessions')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Create a PTM session and generate slots' })
  createSession(@Request() req: any, @Body() dto: CreatePtmSessionDto) {
    return this.ptmService.createSession(req.user.schoolId, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all PTM sessions in this school' })
  getSessions(@Request() req: any) {
    return this.ptmService.getSessions(req.user.schoolId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get PTM session details and slots' })
  getSessionById(@Request() req: any, @Param('id') id: string) {
    return this.ptmService.getSessionById(req.user.schoolId, id);
  }

  @Post('slots/:id/book')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'PARENT')
  @ApiOperation({ summary: 'Book a PTM time slot for a student' })
  bookSlot(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: BookPtmSlotDto,
  ) {
    return this.ptmService.bookSlot(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
      dto,
    );
  }

  @Post('slots/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booked PTM time slot' })
  cancelBooking(@Request() req: any, @Param('id') id: string) {
    return this.ptmService.cancelBooking(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Put('slots/:id/complete')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Complete PTM slot and record teacher feedback' })
  completeSlot(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CompletePtmSlotDto,
  ) {
    return this.ptmService.completeSlot(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
      dto,
    );
  }

  @Get('teachers/:teacherId/schedule')
  @ApiOperation({ summary: 'Get PTM schedule for a teacher' })
  getTeacherSchedule(
    @Request() req: any,
    @Param('teacherId') teacherId: string,
  ) {
    return this.ptmService.getTeacherSchedule(req.user.schoolId, teacherId);
  }

  @Get('students/:studentId/history')
  @ApiOperation({ summary: 'Get PTM history for a student' })
  getStudentPtmHistory(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.ptmService.getStudentPtmHistory(
      req.user.schoolId,
      studentId,
      req.user.id,
      req.user.role,
    );
  }
}
