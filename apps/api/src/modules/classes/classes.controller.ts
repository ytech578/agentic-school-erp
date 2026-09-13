import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Classes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(private service: ClassesService) {}

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT',
  )
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.schoolId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createClass(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      numericLevel?: number;
      academicYearId?: string;
      sections?: string[];
    },
  ) {
    return this.service.createClass(req.user.schoolId, body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateClass(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; numericLevel?: number },
  ) {
    return this.service.updateClass(req.user.schoolId, id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  deleteClass(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteClass(req.user.schoolId, id);
  }

  @Get(':id/sections')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT',
  )
  findSections(@Request() req: any, @Param('id') id: string) {
    return this.service.findSections(req.user.schoolId, id);
  }

  @Post(':id/sections')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createSection(
    @Request() req: any,
    @Param('id') classId: string,
    @Body() body: { name: string; capacity?: number; roomNumber?: string },
  ) {
    return this.service.createSection(req.user.schoolId, classId, body);
  }

  @Delete('sections/:sectionId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  deleteSection(@Request() req: any, @Param('sectionId') sectionId: string) {
    return this.service.deleteSection(req.user.schoolId, sectionId);
  }
}

@ApiTags('Subjects')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private service: ClassesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  findAll(@Request() req: any) {
    return this.service.findAllSubjects(req.user.schoolId);
  }
}
