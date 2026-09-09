import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Activities')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private service: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List activities' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT')
  listActivities(@Request() req: any, @Query('studentId') studentId?: string) {
    return this.service.listActivities(req.user.schoolId, studentId);
  }

  @Post()
  @ApiOperation({ summary: 'Log a student activity/achievement' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  createActivity(@Request() req: any, @Body() body: any) {
    return this.service.createActivity(req.user.schoolId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an activity' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  deleteActivity(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteActivity(req.user.schoolId, id);
  }
}
