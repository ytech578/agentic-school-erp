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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentEnrollmentService } from './student-enrollment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { PERMISSIONS } from '@school-erp/shared';
import {
  CreateStudentEnrollmentDto,
  UpdateEnrollmentStatusDto,
} from './dto/student-enrollment.dto';
import { EnrollmentStatus } from '@prisma/client';

@ApiTags('Student Homeroom Enrollments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('academic/enrollments')
export class StudentEnrollmentController {
  constructor(private service: StudentEnrollmentService) {}

  @Get()
  @ApiOperation({ summary: 'List student homeroom enrollments' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  list(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: EnrollmentStatus,
  ) {
    return this.service.listEnrollments(req.user.schoolId, {
      classId,
      sectionId,
      academicYearId,
      studentId,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student enrollment details by ID' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.getEnrollmentById(req.user.schoolId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Enroll a student into a section' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  create(@Request() req: any, @Body() dto: CreateStudentEnrollmentDto) {
    return this.service.createEnrollment(req.user.schoolId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update student enrollment status' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.service.updateEnrollmentStatus(req.user.schoolId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a student enrollment' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  delete(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteEnrollment(req.user.schoolId, id);
  }
}
