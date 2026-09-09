import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
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

  @Get('departments')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getDepartments(@Request() req: any) {
    return this.service.getDepartments(req.user.schoolId);
  }

  @Get('designations')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getDesignations(@Request() req: any) {
    return this.service.getDesignations(req.user.schoolId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createStaff(@Request() req: any, @Body() body: any) {
    const parsedBody = CreateStaffSchema.parse(body);
    return this.service.createStaff(req.user.schoolId, parsedBody);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getStaffList(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('includeSubjects') includeSubjects?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.service.getStaffList(
      req.user.schoolId,
      pageNum,
      limitNum,
      search,
      includeSubjects === 'true'
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getStaffById(@Request() req: any, @Param('id') id: string) {
    return this.service.getStaffById(req.user.schoolId, id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async updateStaff(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const parsedBody = UpdateStaffSchema.parse(body);
    return this.service.updateStaff(req.user.schoolId, id, parsedBody);
  }
}
