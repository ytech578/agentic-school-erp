import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('super-admin')
  @Roles('SUPER_ADMIN')
  async getSuperAdminDashboard() {
    return await this.dashboardService.getSuperAdminDashboard();
  }

  @Get('school-admin')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getSchoolAdminDashboard(@Request() req: any) {
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getSchoolAdminDashboard(schoolId);
  }

  @Get('principal')
  @Roles('SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN')
  async getPrincipalDashboard(@Request() req: any) {
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getPrincipalDashboard(schoolId);
  }

  @Get('teacher')
  @Roles('SUPER_ADMIN', 'TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN')
  async getTeacherDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getTeacherDashboard(userId, schoolId);
  }

  @Get('student')
  @Roles('SUPER_ADMIN', 'STUDENT', 'PARENT', 'TEACHER', 'PRINCIPAL')
  async getStudentDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getStudentDashboard(userId, schoolId);
  }

  @Get('parent')
  @Roles('SUPER_ADMIN', 'PARENT')
  async getParentDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getParentDashboard(userId, schoolId);
  }

  @Get('parent-detail')
  @Roles('SUPER_ADMIN', 'PARENT')
  async getParentDetail(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getParentDetail(userId, schoolId);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return { stats: [], recentEnrollments: [] };
    }
    return await this.dashboardService.getDashboardStats(schoolId);
  }
}
