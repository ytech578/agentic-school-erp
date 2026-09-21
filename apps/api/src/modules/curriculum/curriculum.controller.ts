import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { CurriculumService } from './curriculum.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { PERMISSIONS } from '@school-erp/shared';
import {
  InitializeCurriculumDto,
  CreateSchoolOfferingDto,
  UpdateSchoolOfferingDto,
  EnrollStudentSubjectsDto,
  CreateBoardDto,
  UpdateBoardDto,
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateSubjectGroupDto,
  UpdateSubjectGroupDto,
  UpdateOfferingStatusDto,
} from './dto/curriculum.dto';

@ApiTags('Curriculum & Board Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

  // -------------------------------------------------------------
  // BOARDS (Master Data)
  // -------------------------------------------------------------

  @Get('boards')
  @ApiOperation({
    summary: 'Get all active Boards (CBSE, CISCE, AP State, TS State)',
  })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getBoards() {
    return this.service.getBoards();
  }

  @Get('boards/:id')
  @ApiOperation({ summary: 'Get Board details by ID' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getBoardById(@Param('id') id: string) {
    return this.service.getBoardById(id);
  }

  @Post('boards')
  @ApiOperation({ summary: 'Create an Education Board (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  createBoard(@Body() dto: CreateBoardDto) {
    return this.service.createBoard(dto);
  }

  @Put('boards/:id')
  @ApiOperation({ summary: 'Update an Education Board (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  updateBoard(@Param('id') id: string, @Body() dto: UpdateBoardDto) {
    return this.service.updateBoard(id, dto);
  }

  // -------------------------------------------------------------
  // CURRICULA & SUBJECT GROUPS (Master Frameworks)
  // -------------------------------------------------------------

  @Get('curriculums')
  @ApiOperation({ summary: 'Get Curriculums / Frameworks' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getCurriculums(@Query('boardId') boardId?: string) {
    return this.service.getCurriculums(boardId);
  }

  @Get('curriculums/:id')
  @ApiOperation({ summary: 'Get Curriculum by ID' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getCurriculumById(@Param('id') id: string) {
    return this.service.getCurriculumById(id);
  }

  @Post('curriculums')
  @ApiOperation({ summary: 'Create a Curriculum Framework (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  createCurriculum(@Body() dto: CreateCurriculumDto) {
    return this.service.createCurriculum(dto);
  }

  @Put('curriculums/:id')
  @ApiOperation({ summary: 'Update a Curriculum Framework (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  updateCurriculum(@Param('id') id: string, @Body() dto: UpdateCurriculumDto) {
    return this.service.updateCurriculum(id, dto);
  }

  @Get('curriculums/:id/framework')
  @ApiOperation({
    summary: 'Get full grade-wise subject framework for a curriculum',
  })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getCurriculumFramework(@Param('id') id: string) {
    return this.service.getCurriculumFramework(id);
  }

  @Get('curriculums/:id/subject-groups')
  @ApiOperation({ summary: 'Get Subject Groups for a Curriculum' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSubjectGroups(@Param('id') id: string) {
    return this.service.getSubjectGroups(id);
  }

  @Get('subject-groups/:id')
  @ApiOperation({ summary: 'Get Subject Group details by ID' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSubjectGroupById(@Param('id') id: string) {
    return this.service.getSubjectGroupById(id);
  }

  @Post('curriculums/:id/subject-groups')
  @ApiOperation({ summary: 'Create a Subject Group under Curriculum (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  createSubjectGroup(
    @Param('id') curriculumId: string,
    @Body() dto: CreateSubjectGroupDto,
  ) {
    return this.service.createSubjectGroup(curriculumId, dto);
  }

  @Put('subject-groups/:id')
  @ApiOperation({ summary: 'Update a Subject Group (Super Admin only)' })
  @Roles('SUPER_ADMIN')
  updateSubjectGroup(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectGroupDto,
  ) {
    return this.service.updateSubjectGroup(id, dto);
  }

  // -------------------------------------------------------------
  // SCHOOL ONBOARDING & CONFIGURATION
  // -------------------------------------------------------------

  @Get('summary')
  @ApiOperation({
    summary: 'Get school curriculum and offering configuration summary',
  })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSummary(@Request() req: any) {
    return this.service.getCurriculumSummary(req.user.schoolId);
  }

  @Post('initialize-school')
  @ApiOperation({ summary: 'Load Recommended Curriculum for the school' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  initializeSchool(@Request() req: any, @Body() dto: InitializeCurriculumDto) {
    return this.service.initializeSchoolCurriculum(req.user.schoolId, dto);
  }

  // -------------------------------------------------------------
  // CANONICAL SCHOOL SUBJECT OFFERINGS
  // -------------------------------------------------------------

  @Get('offerings')
  @ApiOperation({ summary: 'Get all active school subject offerings' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getOfferings(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.getSchoolOfferings(req.user.schoolId, academicYearId);
  }

  @Get('offerings/:id')
  @ApiOperation({ summary: 'Get school subject offering details by ID' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getOfferingById(@Request() req: any, @Param('id') id: string) {
    return this.service.getSchoolOfferingById(req.user.schoolId, id);
  }

  @Post('offerings')
  @ApiOperation({ summary: 'Add a school-level offering or custom subject' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  createOffering(
    @Request() req: any,
    @Body() dto: CreateSchoolOfferingDto,
  ) {
    return this.service.createSchoolOffering(req.user.schoolId, dto);
  }

  @Put('offerings/:id')
  @ApiOperation({ summary: 'Update a school subject offering' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  updateOfferingPut(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolOfferingDto,
  ) {
    return this.service.updateSchoolOffering(req.user.schoolId, id, dto);
  }

  @Patch('offerings/:id')
  @ApiOperation({ summary: 'Partial update of a school subject offering' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  updateOfferingPatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolOfferingDto,
  ) {
    return this.service.updateSchoolOffering(req.user.schoolId, id, dto);
  }

  @Patch('offerings/:id/status')
  @ApiOperation({ summary: 'Toggle offering active/offered status' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  setOfferingStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingStatusDto,
  ) {
    return this.service.toggleOfferingStatus(req.user.schoolId, id, dto.isOffered);
  }

  @Delete('offerings/:id')
  @ApiOperation({ summary: 'Soft-deactivate a school subject offering' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  deleteOffering(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSchoolOffering(req.user.schoolId, id);
  }

  // Backwards compatibility aliases for school-offerings
  @Get('school-offerings')
  @ApiOperation({ summary: 'Get all active school subject offerings (legacy alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSchoolOfferings(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.getSchoolOfferings(req.user.schoolId, academicYearId);
  }

  @Get('school-offerings/:id')
  @ApiOperation({ summary: 'Get school subject offering by ID (legacy alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSchoolOfferingById(@Request() req: any, @Param('id') id: string) {
    return this.service.getSchoolOfferingById(req.user.schoolId, id);
  }

  @Post('school-offerings')
  @ApiOperation({ summary: 'Add a school-level offering (legacy alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  createSchoolOffering(
    @Request() req: any,
    @Body() dto: CreateSchoolOfferingDto,
  ) {
    return this.service.createSchoolOffering(req.user.schoolId, dto);
  }

  @Patch('school-offerings/:id')
  @ApiOperation({ summary: 'Update a school subject offering (legacy alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  updateSchoolOffering(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolOfferingDto,
  ) {
    return this.service.updateSchoolOffering(req.user.schoolId, id, dto);
  }

  @Delete('school-offerings/:id')
  @ApiOperation({ summary: 'Soft-deactivate a school subject offering (legacy alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  deleteSchoolOffering(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSchoolOffering(req.user.schoolId, id);
  }

  @Get('classes/:classId/offerings')
  @ApiOperation({
    summary: 'Get valid subject offerings applicable to class grade level',
  })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getClassOfferings(@Request() req: any, @Param('classId') classId: string) {
    return this.service.getClassOfferings(req.user.schoolId, classId);
  }

  // -------------------------------------------------------------
  // STUDENT SUBJECT ENROLLMENTS (Languages & Electives)
  // -------------------------------------------------------------

  @Get('students/:studentId/enrollments')
  @ApiOperation({ summary: 'Get student enrolled curriculum subjects' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getStudentEnrollments(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.service.getStudentEnrollments(req.user.schoolId, studentId);
  }

  @Get('students/:studentId/subject-enrollments')
  @ApiOperation({ summary: 'Get student enrolled curriculum subjects (canonical alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getStudentSubjectEnrollments(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.service.getStudentEnrollments(req.user.schoolId, studentId);
  }

  @Post('students/:studentId/enrollments')
  @ApiOperation({
    summary: 'Enroll student in selected elective and language offerings',
  })
  @Permissions(PERMISSIONS.CURRICULUM_ASSIGN)
  enrollStudentSubjects(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body() dto: EnrollStudentSubjectsDto,
  ) {
    return this.service.enrollStudentSubjects(
      req.user.schoolId,
      studentId,
      dto,
    );
  }

  @Post('students/:studentId/subject-enrollments')
  @ApiOperation({
    summary: 'Enroll student in selected elective and language offerings (canonical alias)',
  })
  @Permissions(PERMISSIONS.CURRICULUM_ASSIGN)
  enrollStudentSubjectsAlias(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body() dto: EnrollStudentSubjectsDto,
  ) {
    return this.service.enrollStudentSubjects(
      req.user.schoolId,
      studentId,
      dto,
    );
  }

  @Delete('students/:studentId/enrollments/:offeringId')
  @ApiOperation({ summary: 'Unenroll student from a subject offering' })
  @Permissions(PERMISSIONS.CURRICULUM_ASSIGN)
  unenrollStudentSubject(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('offeringId') offeringId: string,
  ) {
    return this.service.unenrollStudentSubject(
      req.user.schoolId,
      studentId,
      offeringId,
    );
  }

  @Delete('students/:studentId/subject-enrollments/:offeringId')
  @ApiOperation({ summary: 'Unenroll student from a subject offering (canonical alias)' })
  @Permissions(PERMISSIONS.CURRICULUM_ASSIGN)
  unenrollStudentSubjectAlias(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('offeringId') offeringId: string,
  ) {
    return this.service.unenrollStudentSubject(
      req.user.schoolId,
      studentId,
      offeringId,
    );
  }

  @Post('classes/:classId/sync-subjects')
  @ApiOperation({
    summary:
      'Sync active curriculum offerings for a class to ClassSubject mappings',
  })
  @Permissions(PERMISSIONS.CURRICULUM_MANAGE)
  syncClassSubjects(@Request() req: any, @Param('classId') classId: string) {
    return this.service.syncClassSubjects(req.user.schoolId, classId);
  }

  @Get('sections/:sectionId/student-enrollments')
  @ApiOperation({
    summary: 'Get section students with their enrolled curriculum subjects',
  })
  @Permissions(PERMISSIONS.CURRICULUM_READ)
  getSectionStudentEnrollments(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.getSectionStudentEnrollments(
      req.user.schoolId,
      sectionId,
    );
  }
}
