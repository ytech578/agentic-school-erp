import {
  Controller,
  Get,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import {
  getTenantContext,
  requireSchoolId,
} from '../../core/tenant/tenant.util';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('super-admin')
  @Roles('SUPER_ADMIN')
  async getSuperAdminDashboard() {
    return await this.dashboardService.getSuperAdminDashboard();
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    return await this.dashboardService.getDashboardStats(
      tenant.schoolId,
      tenant.isGlobal,
    );
  }

  @Get('school-admin')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async getSchoolAdminDashboard(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    return await this.dashboardService.getSchoolAdminDashboard(
      tenant.schoolId,
      tenant.isGlobal,
    );
  }

  @Get('principal')
  @Roles('SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN')
  async getPrincipalDashboard(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    if (tenant.isGlobal && !tenant.schoolId) {
      throw new ForbiddenException(
        'Principal command dashboard is inherently school-scoped to a specific campus. Use /dashboard/super-admin for fleet-wide telemetry.',
      );
    }
    const schoolId = requireSchoolId(tenant.schoolId, 'Principal dashboard');
    return await this.dashboardService.getPrincipalDashboard(schoolId);
  }

  @Get('teacher')
  @Roles('SUPER_ADMIN', 'TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN')
  async getTeacherDashboard(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    if (tenant.isGlobal && !tenant.schoolId) {
      throw new ForbiddenException(
        'Teacher dashboard is inherently school-scoped to campus faculty.',
      );
    }
    const schoolId = requireSchoolId(tenant.schoolId, 'Teacher dashboard');
    return await this.dashboardService.getTeacherDashboard(
      tenant.userId,
      schoolId,
    );
  }

  @Get('student')
  @Roles('SUPER_ADMIN', 'STUDENT', 'PARENT', 'TEACHER', 'PRINCIPAL')
  async getStudentDashboard(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    if (tenant.isGlobal && !tenant.schoolId) {
      throw new ForbiddenException(
        'Student dashboard is inherently school-scoped to enrolled students.',
      );
    }
    const schoolId = requireSchoolId(tenant.schoolId, 'Student dashboard');
    return await this.dashboardService.getStudentDashboard(
      tenant.userId,
      schoolId,
    );
  }

  @Get('parent')
  @Roles('SUPER_ADMIN', 'PARENT')
  async getParentDashboard(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    if (tenant.isGlobal && !tenant.schoolId) {
      throw new ForbiddenException(
        'Parent dashboard is inherently school-scoped to student guardians.',
      );
    }
    const schoolId = requireSchoolId(tenant.schoolId, 'Parent dashboard');
    return await this.dashboardService.getParentDashboard(
      tenant.userId,
      schoolId,
    );
  }

  @Get('parent-detail')
  @Roles('SUPER_ADMIN', 'PARENT')
  async getParentDetail(@Request() req: any) {
    const tenant = getTenantContext(req.user);
    if (tenant.isGlobal && !tenant.schoolId) {
      throw new ForbiddenException(
        'Parent dashboard is inherently school-scoped to student guardians.',
      );
    }
    const schoolId = requireSchoolId(
      tenant.schoolId,
      'Parent detail dashboard',
    );
    return await this.dashboardService.getParentDetail(
      tenant.userId,
      schoolId,
    );
  }
}
