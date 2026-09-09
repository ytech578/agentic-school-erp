import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { ZodValidationPipe } from './core/pipes/zod-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const port = process.env.PORT || 4000;
  const apiPrefix = process.env.API_PREFIX || 'api';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  // ─── Security Middleware ──────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Configure per environment
    }),
  );
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─── Global Pipes, Filters, Interceptors ─────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  // Note: ZodValidationPipe is applied per-route where Zod schemas are used
  // class-validator DTOs use the built-in ValidationPipe from NestJS

  // ─── Swagger Documentation ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI School ERP API')
      .setDescription(
        'REST API documentation for AI School ERP V1.0. All endpoints require authentication except /auth/login, /auth/forgot-password, and /auth/reset-password.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT access token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication and session management')
      .addTag('Users', 'User account management')
      .addTag('Schools', 'School configuration')
      .addTag('Students', 'Student management')
      .addTag('Staff', 'Staff management')
      .addTag('Attendance', 'Attendance tracking')
      .addTag('Fees', 'Fee management')
      .addTag('Exams', 'Examination management')
      .addTag('AI', 'AI assistant')
      .addTag('Dashboard', 'Dashboard statistics')
      .addTag('Notifications', 'Notification management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // ─── Health Check Route ───────────────────────────────────────────────────
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 AI School ERP API running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  }
}

bootstrap();
