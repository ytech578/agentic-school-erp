import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Assignments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private service: AssignmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create assignment' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  createAssignment(@Request() req: any, @Body() body: any) {
    return this.service.createAssignment(req.user.schoolId, body, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List assignments' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  listAssignments(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string
  ) {
    return this.service.listAssignments(req.user.schoolId, classId, sectionId);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get assignment submissions' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getSubmissions(@Param('id') id: string) {
    return this.service.getSubmissions(id);
  }

  @Post(':id/submissions/:studentId')
  @ApiOperation({ summary: 'Grade or update submission' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  submitAssignment(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() body: any
  ) {
    return this.service.submitAssignment(id, studentId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assignment' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  deleteAssignment(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteAssignment(req.user.schoolId, id);
  }
}

