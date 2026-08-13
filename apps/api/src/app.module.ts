import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './core/database/prisma.module';
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
import { AdmissionsModule } from './modules/admissions/admissions.module';
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
    StorageModule,
    EmailModule,

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
  ],
})
export class AppModule {}
