import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Schools')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  findAll() {
    return this.schoolsService.findAll();
  }

  @Get('current')
  getCurrent(@Request() req: any) {
    return this.schoolsService.findCurrent(req.user.schoolId);
  }

  @Put('current')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateCurrent(@Request() req: any, @Body() data: any) {
    return this.schoolsService.updateSchool(req.user.schoolId, data);
  }

  @Get('academic-years')
  getAcademicYears(@Request() req: any) {
    return this.schoolsService.getAcademicYears(req.user.schoolId);
  }

  @Post('academic-years')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createAcademicYear(
    @Request() req: any,
    @Body() data: { name: string; startDate: string; endDate: string },
  ) {
    return this.schoolsService.createAcademicYear(req.user.schoolId, data);
  }

  @Patch('academic-years/:id/activate')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  activateAcademicYear(@Request() req: any, @Param('id') yearId: string) {
    return this.schoolsService.setActiveAcademicYear(req.user.schoolId, yearId);
  }
}
