import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { AdmissionStatus, EnquiryStatus } from '@prisma/client';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  // ================= ENQUIRIES =================

  @Post('enquiries')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createEnquiry(@Request() req: any, @Body() data: any) {
    return this.admissionsService.createEnquiry(req.user.schoolId, data);
  }

  @Get('enquiries')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findAllEnquiries(@Request() req: any) {
    return this.admissionsService.findAllEnquiries(req.user.schoolId);
  }

  @Patch('enquiries/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateEnquiryStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: EnquiryStatus) {
    return this.admissionsService.updateEnquiryStatus(req.user.schoolId, id, status);
  }

  // ================= APPLICATIONS =================

  @Post('applications')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createApplication(@Request() req: any, @Body() data: any) {
    return this.admissionsService.createApplication(req.user.schoolId, data);
  }

  @Get('applications')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findAllApplications(@Request() req: any) {
    return this.admissionsService.findAllApplications(req.user.schoolId);
  }

  @Get('applications/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getApplicationById(@Request() req: any, @Param('id') id: string) {
    return this.admissionsService.getApplicationById(req.user.schoolId, id);
  }

  @Patch('applications/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateApplicationStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: AdmissionStatus) {
    return this.admissionsService.updateApplicationStatus(req.user.schoolId, id, status);
  }

  @Post('applications/:id/convert')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  convertApplicationToStudent(@Request() req: any, @Param('id') id: string) {
    return this.admissionsService.convertApplicationToStudent(req.user.schoolId, id);
  }

  // ================= ANALYTICS =================

  @Get('analytics')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getAnalytics(@Request() req: any) {
    return this.admissionsService.getAnalytics(req.user.schoolId);
  }
}
