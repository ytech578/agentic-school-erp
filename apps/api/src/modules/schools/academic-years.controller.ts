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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AcademicYearsService } from './academic-years.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { PERMISSIONS } from '@school-erp/shared';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  LockAcademicYearDto,
} from './dto/academic-year.dto';

@ApiTags('Academic Years')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private service: AcademicYearsService) {}

  @Get()
  @ApiOperation({ summary: 'List academic years for the authenticated school' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findAll(@Request() req: any) {
    return this.service.getAcademicYears(req.user.schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific academic year' })
  @Permissions(PERMISSIONS.ACADEMIC_READ)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.getAcademicYearById(req.user.schoolId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new academic year session' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  create(@Request() req: any, @Body() dto: CreateAcademicYearDto) {
    return this.service.createAcademicYear(req.user.schoolId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an academic year session' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.service.updateAcademicYear(req.user.schoolId, id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Set this academic year as active for the school' })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  activate(@Request() req: any, @Param('id') id: string) {
    return this.service.setActiveAcademicYear(req.user.schoolId, id);
  }

  @Patch(':id/lock')
  @ApiOperation({
    summary: 'Lock or unlock academic session against structural changes',
  })
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  setLock(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: LockAcademicYearDto,
  ) {
    return this.service.setLockAcademicYear(req.user.schoolId, id, dto.isLocked);
  }
}
