import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
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
  const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const corsOrigin = rawCorsOrigin.includes(',')
    ? rawCorsOrigin.split(',').map((o) => o.trim())
    : rawCorsOrigin;
  const isProduction = process.env.NODE_ENV === 'production';

  // ─── Security Middleware ──────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'https:', 'data:'],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // In development, allow Swagger UI resources
    }),
  );
  app.use(cookieParser());

  // ─── Body Parsers (Support base64 QR codes & file uploads) ───────────────
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ limit: '25mb', extended: true }));

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // In development, allow localhost or 127.0.0.1 on any port (3000, 3001, etc.)
      if (
        !isProduction &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      const allowedOrigins = Array.isArray(corsOrigin)
        ? corsOrigin
        : [corsOrigin];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-school-id',
      'X-School-Id',
      'x-refresh-token',
      'X-Refresh-Token',
      'x-razorpay-signature',
      'Accept',
      'Cache-Control',
      'Range',
      'Origin',
    ],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
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
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 AI School ERP API running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  }
}

bootstrap();
