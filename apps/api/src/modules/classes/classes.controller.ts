import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { PERMISSIONS } from '@school-erp/shared';
import {
  CreateClassDto,
  UpdateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
} from './dto/class.dto';
import {
  CreateTeacherAssignmentDto,
  UpdateTeacherAssignmentDto,
} from './dto/teacher-assignment.dto';

@ApiTags('Classes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('classes')
export class ClassesController {
  constructor(private service: ClassesService) {}

  @Get()
  @ApiOperation({ summary: 'List all classes with section details' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get class details by ID' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.getClassById(req.user.schoolId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new class with sections' })
  @Permissions(PERMISSIONS.CLASS_MANAGE)
  createClass(@Request() req: any, @Body() dto: CreateClassDto) {
    return this.service.createClass(req.user.schoolId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update class properties' })
  @Permissions(PERMISSIONS.CLASS_MANAGE)
  updateClass(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.service.updateClass(req.user.schoolId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a class if no students enrolled' })
  @Permissions(PERMISSIONS.CLASS_MANAGE)
  deleteClass(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteClass(req.user.schoolId, id);
  }

  @Get(':id/sections')
  @ApiOperation({ summary: 'List sections belonging to a class' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findSections(@Request() req: any, @Param('id') id: string) {
    return this.service.findSections(req.user.schoolId, id);
  }

  @Post(':id/sections')
  @ApiOperation({ summary: 'Create a new section under a class' })
  @Permissions(PERMISSIONS.SECTION_MANAGE)
  createSection(
    @Request() req: any,
    @Param('id') classId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.service.createSection(req.user.schoolId, classId, dto);
  }

  @Delete('sections/:sectionId')
  @ApiOperation({ summary: 'Delete a section (legacy path alias)' })
  @Permissions(PERMISSIONS.SECTION_MANAGE)
  deleteSectionLegacy(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.deleteSection(req.user.schoolId, sectionId);
  }
}

@ApiTags('Sections')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('sections')
export class SectionsController {
  constructor(private service: ClassesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get section details by ID' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.getSectionById(req.user.schoolId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update section properties' })
  @Permissions(PERMISSIONS.SECTION_MANAGE)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.service.updateSection(req.user.schoolId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a section if no students enrolled' })
  @Permissions(PERMISSIONS.SECTION_MANAGE)
  delete(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSection(req.user.schoolId, id);
  }
}

@ApiTags('Teacher Assignments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('academic/teacher-assignments')
export class TeacherAssignmentsController {
  constructor(private service: ClassesService) {}

  @Get()
  @ApiOperation({ summary: 'List faculty subject and class assignments' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  list(
    @Request() req: any,
    @Query('staffId') staffId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.listTeacherAssignments(req.user.schoolId, {
      staffId,
      sectionId,
      classId,
      academicYearId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher assignment details by ID' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.getTeacherAssignmentById(req.user.schoolId, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Assign a teacher to a section and course offering',
  })
  @Permissions(PERMISSIONS.SUBJECT_ASSIGN)
  create(@Request() req: any, @Body() dto: CreateTeacherAssignmentDto) {
    return this.service.createTeacherAssignment(req.user.schoolId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a teacher assignment' })
  @Permissions(PERMISSIONS.SUBJECT_ASSIGN)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAssignmentDto,
  ) {
    return this.service.updateTeacherAssignment(req.user.schoolId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a teacher assignment' })
  @Permissions(PERMISSIONS.SUBJECT_ASSIGN)
  delete(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteTeacherAssignment(req.user.schoolId, id);
  }
}

@ApiTags('Subjects')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private service: ClassesService) {}

  @Get()
  @ApiOperation({
    summary: 'List active subjects (legacy compatibility adapter)',
  })
  @Permissions(PERMISSIONS.SUBJECT_READ)
  findAll(@Request() req: any) {
    return this.service.findAllSubjects(req.user.schoolId);
  }
}
