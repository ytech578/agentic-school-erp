import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DisciplineService } from './discipline.service';
import {
  CreateIncidentDto,
  UpdateIncidentStatusDto,
  NotifyParentDto,
  UpdateDisciplineIncidentDto,
} from './dto/discipline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Discipline')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discipline')
export class DisciplineController {
  constructor(private readonly disciplineService: DisciplineService) {}

  @Post('incidents')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Log a new disciplinary incident' })
  createIncident(@Request() req: any, @Body() dto: CreateIncidentDto) {
    return this.disciplineService.createIncident(
      req.user.schoolId,
      req.user.id,
      dto,
    );
  }

  @Get('incidents')
  @ApiOperation({
    summary: 'List disciplinary incidents (with confidentiality filtering)',
  })
  getIncidents(
    @Request() req: any,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.disciplineService.getIncidents(
      req.user.schoolId,
      req.user.id,
      req.user.role,
      { studentId, status, category },
    );
  }

  @Get('incidents/:id')
  @ApiOperation({ summary: 'Get disciplinary incident details' })
  getIncidentById(@Request() req: any, @Param('id') id: string) {
    return this.disciplineService.getIncidentById(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Put('incidents/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'Update incident status, remediation action, and resolution',
  })
  updateIncidentStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    return this.disciplineService.updateIncidentStatus(
      req.user.schoolId,
      id,
      dto,
    );
  }

  @Put('incidents/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Update incident details' })
  updateIncident(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineIncidentDto,
  ) {
    return this.disciplineService.updateIncident(
      req.user.schoolId,
      id,
      dto,
    );
  }

  @Post('incidents/:id/notify-parent')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({
    summary: 'Dispatch disciplinary alert notification to parents',
  })
  notifyParent(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: NotifyParentDto,
  ) {
    return this.disciplineService.notifyParent(req.user.schoolId, id, dto);
  }

  @Get('students/:studentId/summary')
  @ApiOperation({
    summary: 'Get student disciplinary incident breakdown and metrics',
  })
  getStudentIncidentSummary(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.disciplineService.getStudentIncidentSummary(
      req.user.schoolId,
      studentId,
    );
  }
}
