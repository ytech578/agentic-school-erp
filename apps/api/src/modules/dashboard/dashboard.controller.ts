import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    // req.user contains the JWT payload
    const schoolId = req.user.schoolId;
    
    // In a multi-tenant system, super admins might not have a schoolId, 
    // but for this MVP, assuming users accessing dashboard belong to a school.
    if (!schoolId) {
      return { stats: [], recentEnrollments: [] };
    }

    return await this.dashboardService.getDashboardStats(schoolId);
  }

  @Get('teacher')
  async getTeacherDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getTeacherDashboard(userId, schoolId);
  }

  @Get('parent')
  async getParentDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getParentDashboard(userId, schoolId);
  }

  @Get('student')
  async getStudentDashboard(@Request() req: any) {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    return await this.dashboardService.getStudentDashboard(userId, schoolId);
  }
}
