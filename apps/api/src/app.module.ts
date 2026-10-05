import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './core/guards/user-throttler.guard';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AuditLogInterceptor } from './core/interceptors/audit-log.interceptor';
import { TenantMiddleware } from './core/middleware/tenant.middleware';
import { PrismaModule } from './core/database/prisma.module';
import { RedisModule } from './core/cache/redis.module';
import { HealthModule } from './core/health/health.module';
import { JobsModule } from './core/jobs/jobs.module';
import { I18nModule } from './core/i18n/i18n.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { StudentsModule } from './modules/students/students.module';
import { StaffModule } from './modules/staff/staff.module';
import { ClassesModule } from './modules/classes/classes.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FeesModule } from './modules/fees/fees.module';
import { ExamsModule } from './modules/exams/exams.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AIModule } from './modules/ai/ai.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { StorageModule } from './services/storage/storage.module';
import { EmailModule } from './services/email/email.module';
import { FcmModule } from './services/fcm/fcm.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { MessagesModule } from './modules/messages/messages.module';
import { HRModule } from './modules/hr/hr.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { PtmModule } from './modules/ptm/ptm.module';
import { DisciplineModule } from './modules/discipline/discipline.module';
import { DpdpModule } from './modules/dpdp/dpdp.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

import { AlumniModule } from './modules/alumni/alumni.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import aiConfig from './config/ai.config';

@Module({
  imports: [
    // ─── Config ────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, aiConfig],
    }),

    // ─── Task Scheduling ──────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Observability & Metrics ───────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),

    // ─── Rate Limiting ─────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.rateLimitWindowMs', 60000),
          limit: config.get<number>('app.rateLimitMax', 100),
        },
      ],
    }),

    // ─── Core ──────────────────────────────────────────────────────────
    PrismaModule,
    RedisModule,
    JobsModule,
    HealthModule,
    I18nModule,
    StorageModule,
    EmailModule,
    FcmModule,

    // ─── Feature Modules ───────────────────────────────────────────────
    AuthModule,
    UsersModule,
    SchoolsModule,
    StudentsModule,
    StaffModule,
    ClassesModule,
    AttendanceModule,
    FeesModule,
    ExamsModule,
    DashboardModule,
    NotificationsModule,
    AIModule,
    ReportsModule,
    TimetableModule,
    AdmissionsModule,
    MessagesModule,
    HRModule,
    AssignmentsModule,
    ActivitiesModule,
    CurriculumModule,
    PayrollModule,
    CertificatesModule,
    PtmModule,
    DisciplineModule,
    DpdpModule,
    SubscriptionsModule,
    AlumniModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
