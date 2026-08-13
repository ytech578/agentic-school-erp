import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CreateStudentSchema } from '@school-erp/shared';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createStudent(
    @Request() req: any,
    @Body() body: any,
  ) {
    const parsedBody = CreateStudentSchema.parse(body);
    const schoolId = req.user.schoolId;
    return this.studentsService.createStudent(schoolId, parsedBody);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudents(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getStudents(
      schoolId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudentById(@Request() req: any, @Param('id') id: string) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getStudentById(schoolId, id);
  }
}
