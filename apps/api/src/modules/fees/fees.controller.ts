import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeStructureInput, CollectFeeInput } from '@school-erp/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Fees')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('heads')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getFeeHeads(@Request() req: any) {
    return this.feesService.getFeeHeads(req.user.schoolId);
  }

  @Post('heads')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createFeeHead(@Request() req: any, @Body() data: { name: string; description?: string }) {
    return this.feesService.createFeeHead(req.user.schoolId, data);
  }

  @Get('structures')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getStructuresByClass(
    @Request() req: any, 
    @Query('academicYearId') academicYearId: string, 
    @Query('classId') classId: string
  ) {
    return this.feesService.getStructuresByClass(req.user.schoolId, academicYearId, classId);
  }

  @Post('structures')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createOrUpdateStructure(@Request() req: any, @Body() data: CreateFeeStructureInput) {
    return this.feesService.createOrUpdateStructure(req.user.schoolId, data);
  }

  @Get('students')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getStudentFeeSummary(@Request() req: any, @Query('academicYearId') academicYearId: string) {
    return this.feesService.getStudentFeeSummary(req.user.schoolId, academicYearId);
  }

  @Post('collect')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  collectFee(@Request() req: any, @Body() data: CollectFeeInput) {
    return this.feesService.collectFee(req.user.schoolId, req.user.id, data);
  }
}
