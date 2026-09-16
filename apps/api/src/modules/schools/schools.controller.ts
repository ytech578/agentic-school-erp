import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import {
  CreateSchoolDto,
  UpdateSchoolDto,
  ToggleSchoolStatusDto,
} from './dto/create-school.dto';

@ApiTags('Schools')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  @ApiOperation({ summary: 'List all onboarded schools (with metrics)' })
  findAll() {
    return this.schoolsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Onboard a new school into the multi-tenant fleet (Super Admin only)' })
  createSchool(@Request() req: any, @Body() data: CreateSchoolDto) {
    return this.schoolsService.createSchool(data, req.user?.id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get details of current active school' })
  getCurrent(@Request() req: any) {
    return this.schoolsService.findCurrent(req.user.schoolId);
  }

  @Put('current')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update profile of current school' })
  updateCurrent(@Request() req: any, @Body() data: any) {
    return this.schoolsService.updateSchool(req.user.schoolId, data);
  }

  @Get('academic-years')
  @ApiOperation({ summary: 'List academic years for current school' })
  getAcademicYears(@Request() req: any) {
    return this.schoolsService.getAcademicYears(req.user.schoolId);
  }

  @Post('academic-years')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create an academic year for current school' })
  createAcademicYear(
    @Request() req: any,
    @Body() data: { name: string; startDate: string; endDate: string },
  ) {
    return this.schoolsService.createAcademicYear(req.user.schoolId, data);
  }

  @Patch('academic-years/:id/activate')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Activate an academic year for current school' })
  activateAcademicYear(@Request() req: any, @Param('id') yearId: string) {
    return this.schoolsService.setActiveAcademicYear(req.user.schoolId, yearId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get detailed school profile by ID (Super Admin only)' })
  getSchoolById(@Param('id') id: string) {
    return this.schoolsService.findById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update school details by ID (Super Admin only)' })
  updateSchoolById(@Param('id') id: string, @Body() data: UpdateSchoolDto) {
    return this.schoolsService.updateSchoolById(id, data);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Activate or suspend school campus by ID (Super Admin only)' })
  toggleSchoolStatus(@Param('id') id: string, @Body() data: ToggleSchoolStatusDto) {
    return this.schoolsService.toggleSchoolStatus(id, data.isActive);
  }
}
