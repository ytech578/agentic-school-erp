import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CreateStaffSchema, UpdateStaffSchema } from '@school-erp/shared';

@ApiTags('Staff')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private service: StaffService) {}

  private async resolveSchoolId(req: any): Promise<string> {
    if (req.user?.schoolId) return req.user.schoolId;
    const headerSchoolId = req.headers?.['x-school-id'];
    const querySchoolId = req.query?.schoolId;
    const targetSchoolId = headerSchoolId || querySchoolId;
    if (
      targetSchoolId &&
      typeof targetSchoolId === 'string' &&
      targetSchoolId.trim()
    ) {
      return targetSchoolId.trim();
    }
    const defaultSchool = await this.service.getDefaultSchoolId();
    if (defaultSchool) return defaultSchool;
    throw new ForbiddenException('Valid school context is required');
  }

  @Get('departments')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getDepartments(@Request() req: any) {
    const schoolId = await this.resolveSchoolId(req);
    return this.service.getDepartments(schoolId);
  }

  @Get('designations')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getDesignations(@Request() req: any) {
    const schoolId = await this.resolveSchoolId(req);
    return this.service.getDesignations(schoolId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createStaff(@Request() req: any, @Body() body: any) {
    const schoolId = await this.resolveSchoolId(req);
    const parsedBody = CreateStaffSchema.parse(body);
    return this.service.createStaff(schoolId, parsedBody);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStaffList(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
    @Query('includeSubjects') includeSubjects?: string,
  ) {
    const schoolId = await this.resolveSchoolId(req);
    const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : 1;
    let limitNum = 100;
    if (limit === 'all' || limit === '-1') {
      limitNum = 1000;
    } else if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limitNum = Math.min(parsed, 1000);
      }
    }

    const activeBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.service.getStaffList(
      schoolId,
      pageNum,
      limitNum,
      search,
      includeSubjects === 'true',
      departmentId?.trim() || undefined,
      activeBool,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStaffById(@Request() req: any, @Param('id') id: string) {
    const schoolId = await this.resolveSchoolId(req);
    return this.service.getStaffById(schoolId, id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async updateStaff(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const schoolId = await this.resolveSchoolId(req);
    const parsedBody = UpdateStaffSchema.parse(body);
    return this.service.updateStaff(schoolId, id, parsedBody);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async updateStaffStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      isActive: boolean;
      resignDate?: string;
      reason?: string;
    },
  ) {
    const schoolId = await this.resolveSchoolId(req);
    return this.service.updateStaffStatus(schoolId, id, body);
  }
}
