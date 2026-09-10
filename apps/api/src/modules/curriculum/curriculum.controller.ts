import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import {
  InitializeCurriculumDto,
  CreateSchoolOfferingDto,
  UpdateSchoolOfferingDto,
  EnrollStudentSubjectsDto,
} from './dto/curriculum.dto';

@ApiTags('Curriculum & Board Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

  @Get('boards')
  @ApiOperation({ summary: 'Get all active Boards (CBSE, CISCE, AP State, TS State)' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  getBoards() {
    return this.service.getBoards();
  }

  @Get('curriculums')
  @ApiOperation({ summary: 'Get Curriculums / Versions' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getCurriculums(@Query('boardId') boardId?: string) {
    return this.service.getCurriculums(boardId);
  }

  @Get('curriculums/:id/framework')
  @ApiOperation({ summary: 'Get full grade-wise subject framework for a curriculum' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getCurriculumFramework(@Param('id') id: string) {
    return this.service.getCurriculumFramework(id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get school curriculum and offering configuration summary' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getSummary(@Request() req: any) {
    return this.service.getCurriculumSummary(req.user.schoolId);
  }

  @Post('initialize-school')
  @ApiOperation({ summary: 'Load Recommended Curriculum for the school' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  initializeSchool(@Request() req: any, @Body() dto: InitializeCurriculumDto) {
    return this.service.initializeSchoolCurriculum(req.user.schoolId, dto);
  }

  @Get('school-offerings')
  @ApiOperation({ summary: 'Get all active school subject offerings' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  getSchoolOfferings(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.getSchoolOfferings(req.user.schoolId, academicYearId);
  }

  @Post('school-offerings')
  @ApiOperation({ summary: 'Add a school-level offering or custom subject' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createSchoolOffering(@Request() req: any, @Body() dto: CreateSchoolOfferingDto) {
    return this.service.createSchoolOffering(req.user.schoolId, dto);
  }

  @Patch('school-offerings/:id')
  @ApiOperation({ summary: 'Update a school subject offering (periods, status, marks)' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateSchoolOffering(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolOfferingDto,
  ) {
    return this.service.updateSchoolOffering(req.user.schoolId, id, dto);
  }

  @Delete('school-offerings/:id')
  @ApiOperation({ summary: 'Soft-deactivate a school subject offering' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  deleteSchoolOffering(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSchoolOffering(req.user.schoolId, id);
  }

  @Get('classes/:classId/offerings')
  @ApiOperation({ summary: 'Get valid subject offerings applicable to class grade level' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getClassOfferings(@Request() req: any, @Param('classId') classId: string) {
    return this.service.getClassOfferings(req.user.schoolId, classId);
  }

  @Get('students/:studentId/enrollments')
  @ApiOperation({ summary: 'Get student enrolled curriculum subjects' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  getStudentEnrollments(@Request() req: any, @Param('studentId') studentId: string) {
    return this.service.getStudentEnrollments(req.user.schoolId, studentId);
  }

  @Post('students/:studentId/enrollments')
  @ApiOperation({ summary: 'Enroll student in selected elective and language offerings' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  enrollStudentSubjects(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body() dto: EnrollStudentSubjectsDto,
  ) {
    return this.service.enrollStudentSubjects(req.user.schoolId, studentId, dto);
  }

  @Post('classes/:classId/sync-subjects')
  @ApiOperation({ summary: 'Sync active curriculum offerings for a class to ClassSubject mappings' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  syncClassSubjects(@Request() req: any, @Param('classId') classId: string) {
    return this.service.syncClassSubjects(req.user.schoolId, classId);
  }

  @Get('sections/:sectionId/student-enrollments')
  @ApiOperation({ summary: 'Get section students with their enrolled curriculum subjects' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  getSectionStudentEnrollments(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.getSectionStudentEnrollments(req.user.schoolId, sectionId);
  }
}
