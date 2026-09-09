import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
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
