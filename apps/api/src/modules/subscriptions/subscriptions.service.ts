import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  UpdateSubscriptionDto,
  SubscriptionPlanEnum,
  SubscriptionStatusEnum,
} from './dto/subscription.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

const PLAN_PRESETS: Record<
  SubscriptionPlanEnum,
  {
    maxStudents: number;
    maxStaff: number;
    maxStorageGb: number;
    maxAiTokensMonthly: number;
  }
> = {
  [SubscriptionPlanEnum.FREE_PILOT]: {
    maxStudents: 200,
    maxStaff: 30,
    maxStorageGb: 5,
    maxAiTokensMonthly: 500000,
  },
  [SubscriptionPlanEnum.STARTER]: {
    maxStudents: 500,
    maxStaff: 60,
    maxStorageGb: 20,
    maxAiTokensMonthly: 1500000,
  },
  [SubscriptionPlanEnum.GROWTH]: {
    maxStudents: 1500,
    maxStaff: 150,
    maxStorageGb: 100,
    maxAiTokensMonthly: 5000000,
  },
  [SubscriptionPlanEnum.ENTERPRISE]: {
    maxStudents: 5000,
    maxStaff: 500,
    maxStorageGb: 500,
    maxAiTokensMonthly: 20000000,
  },
};

export const PLAN_FEATURES: Record<SubscriptionPlanEnum, string[]> = {
  [SubscriptionPlanEnum.FREE_PILOT]: [
    'core_academics',
    'attendance',
    'basic_reports',
    'single_tenant',
  ],
  [SubscriptionPlanEnum.STARTER]: [
    'core_academics',
    'attendance',
    'fee_management',
    'ptm_scheduling',
    'certificates',
    'discipline_log',
    'basic_reports',
  ],
  [SubscriptionPlanEnum.GROWTH]: [
    'core_academics',
    'attendance',
    'fee_management',
    'payroll_payslips',
    'ptm_scheduling',
    'certificates',
    'discipline_log',
    'alumni_directory',
    'dpdp_privacy',
    'ai_copilot',
    'advanced_analytics',
  ],
  [SubscriptionPlanEnum.ENTERPRISE]: [
    'core_academics',
    'attendance',
    'fee_management',
    'payroll_payslips',
    'ptm_scheduling',
    'certificates',
    'discipline_log',
    'alumni_directory',
    'dpdp_privacy',
    'ai_copilot',
    'advanced_analytics',
    'multi_branch_fleet',
    'custom_branding',
    'dedicated_sla',
    'priority_support',
  ],
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. GET OR INITIALIZE SUBSCRIPTION ─────────────────────────────────────

  async getSubscription(schoolId?: string | null) {
    let validSchoolId = schoolId;
    if (!validSchoolId) {
      const primarySchool = await this.prisma.school.findFirst({
        select: { id: true },
      });
      if (!primarySchool) {
        throw new NotFoundException('No schools configured in fleet.');
      }
      validSchoolId = primarySchool.id;
    }

    let sub = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId: validSchoolId },
    });

    if (!sub) {
      // Auto-provision initial FREE_PILOT subscription
      const defaults = PLAN_PRESETS[SubscriptionPlanEnum.FREE_PILOT];
      sub = await this.prisma.schoolSubscription.create({
        data: {
          schoolId: validSchoolId,
          plan: 'FREE_PILOT',
          status: 'ACTIVE',
          maxStudents: defaults.maxStudents,
          maxStaff: defaults.maxStaff,
          maxStorageGb: defaults.maxStorageGb,
          maxAiTokensMonthly: defaults.maxAiTokensMonthly,
        },
      });
    }

    // Real-time utilization metrics
    const [activeStudents, activeStaff] = await Promise.all([
      this.prisma.student.count({
        where: { schoolId: validSchoolId, isActive: true },
      }),
      this.prisma.staff.count({
        where: { schoolId: validSchoolId, isActive: true },
      }),
    ]);

    return {
      subscription: sub,
      metrics: {
        students: {
          used: activeStudents,
          limit: sub.maxStudents,
          percent: Math.min(
            100,
            Math.round((activeStudents / sub.maxStudents) * 100),
          ),
        },
        staff: {
          used: activeStaff,
          limit: sub.maxStaff,
          percent: Math.min(
            100,
            Math.round((activeStaff / sub.maxStaff) * 100),
          ),
        },
        storage: {
          usedGb: sub.currentStorageGbUsed,
          limitGb: sub.maxStorageGb,
          percent: Math.min(
            100,
            Math.round((sub.currentStorageGbUsed / sub.maxStorageGb) * 100),
          ),
        },
        aiTokens: {
          used: sub.currentAiTokensUsed,
          limit: sub.maxAiTokensMonthly,
          percent: Math.min(
            100,
            Math.round(
              (sub.currentAiTokensUsed / sub.maxAiTokensMonthly) * 100,
            ),
          ),
        },
      },
      features: PLAN_FEATURES[sub.plan as SubscriptionPlanEnum] || [],
    };
  }

  // ─── 2. UPDATE PLAN OR CUSTOM QUOTAS (SUPER ADMIN) ────────────────────────

  async updateSubscription(schoolId: string, dto: UpdateSubscriptionDto) {
    const validSchoolId = requireSchoolId(schoolId);

    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
    });
    if (!school) {
      throw new NotFoundException(`School not found.`);
    }

    const preset =
      PLAN_PRESETS[dto.plan] || PLAN_PRESETS[SubscriptionPlanEnum.FREE_PILOT];

    const maxStudents = dto.maxStudents || preset.maxStudents;
    const maxStaff = dto.maxStaff || preset.maxStaff;
    const maxStorageGb = dto.maxStorageGb || preset.maxStorageGb;
    const maxAiTokensMonthly =
      dto.maxAiTokensMonthly || preset.maxAiTokensMonthly;

    return this.prisma.schoolSubscription.upsert({
      where: { schoolId: validSchoolId },
      update: {
        plan: dto.plan as any,
        status: (dto.status as any) || 'ACTIVE',
        maxStudents,
        maxStaff,
        maxStorageGb,
        maxAiTokensMonthly,
      },
      create: {
        schoolId: validSchoolId,
        plan: dto.plan as any,
        status: (dto.status as any) || 'ACTIVE',
        maxStudents,
        maxStaff,
        maxStorageGb,
        maxAiTokensMonthly,
      },
    });
  }

  // ─── 3. QUOTA ENFORCEMENT GUARD ───────────────────────────────────────────

  async checkQuota(
    schoolId: string,
    resource: 'STUDENTS' | 'STAFF' | 'STORAGE' | 'AI_TOKENS',
    delta = 1,
  ): Promise<boolean> {
    const { subscription, metrics } = await this.getSubscription(schoolId);

    if (
      subscription.status !== 'ACTIVE' &&
      subscription.status !== 'TRIALING'
    ) {
      throw new ForbiddenException(
        `School subscription is ${subscription.status}. Access to modifications is restricted. Please contact sales.`,
      );
    }

    switch (resource) {
      case 'STUDENTS':
        if (metrics.students.used + delta > subscription.maxStudents) {
          throw new ForbiddenException(
            `Student limit reached (${metrics.students.used}/${subscription.maxStudents}). Upgrade your subscription tier to enroll more students.`,
          );
        }
        break;

      case 'STAFF':
        if (metrics.staff.used + delta > subscription.maxStaff) {
          throw new ForbiddenException(
            `Staff limit reached (${metrics.staff.used}/${subscription.maxStaff}). Upgrade your plan to onboard additional faculty.`,
          );
        }
        break;

      case 'STORAGE':
        if (
          subscription.currentStorageGbUsed + delta >
          subscription.maxStorageGb
        ) {
          throw new ForbiddenException(
            `Storage limit exceeded (${subscription.currentStorageGbUsed.toFixed(2)}GB/${subscription.maxStorageGb}GB). Upgrade storage tier.`,
          );
        }
        break;

      case 'AI_TOKENS':
        if (
          subscription.currentAiTokensUsed + delta >
          subscription.maxAiTokensMonthly
        ) {
          throw new ForbiddenException(
            `Monthly AI token limit reached (${subscription.currentAiTokensUsed}/${subscription.maxAiTokensMonthly}). Upgrade to unlock additional AI generation.`,
          );
        }
        break;
    }

    return true;
  }

  async recordAiUsage(schoolId: string, tokens: number) {
    if (!schoolId || tokens <= 0) return;
    try {
      await this.prisma.schoolSubscription.update({
        where: { schoolId },
        data: {
          currentAiTokensUsed: { increment: tokens },
        },
      });
    } catch {
      // Non-fatal if record does not exist
    }
  }

  async recordStorageUsage(schoolId: string, bytesUsed: number) {
    if (!schoolId || bytesUsed <= 0) return;
    const gbDelta = bytesUsed / (1024 * 1024 * 1024);
    try {
      await this.prisma.schoolSubscription.updateMany({
        where: { schoolId },
        data: {
          currentStorageGbUsed: { increment: gbDelta },
        },
      });
    } catch {
      // Non-fatal
    }
  }

  // ─── 4. SCHEDULED CRON JOBS ───────────────────────────────────────────────

  /**
   * Monthly reset of AI token usage on the 1st day of every month at midnight
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyAiTokens() {
    this.logger.log(
      'Executing monthly reset of AI token usage counters across all schools...',
    );
    try {
      const result = await this.prisma.schoolSubscription.updateMany({
        data: {
          currentAiTokensUsed: 0,
        },
      });
      this.logger.log(
        `Successfully reset AI token counters for ${result.count} subscriptions.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to reset monthly AI tokens: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Daily check for expired subscriptions (renewsAt < now and status in ACTIVE, TRIALING) -> PAST_DUE
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkSubscriptionExpirations() {
    this.logger.log('Checking for expired subscriptions...');
    try {
      const now = new Date();
      const result = await this.prisma.schoolSubscription.updateMany({
        where: {
          renewsAt: { lt: now },
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        data: {
          status: 'PAST_DUE',
        },
      });
      if (result.count > 0) {
        this.logger.warn(`Marked ${result.count} subscriptions as PAST_DUE.`);
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to check subscription expirations: ${err.message}`,
        err.stack,
      );
    }
  }
}
