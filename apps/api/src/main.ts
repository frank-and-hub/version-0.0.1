import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ValkeyService } from './cache/valkey.service';
import { AuditService } from './audit/audit.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const valkeyService = app.get(ValkeyService);
  const auditService = app.get(AuditService);
  const port = configService.get<number>('port', 4000);
  const corsOrigin = configService.get<string>('corsOrigin', 'http://localhost:3000');

  // 1. API Global Prefix
  app.setGlobalPrefix('api');

  // 2. CORS configuration
  app.enableCors({
    origin: [corsOrigin, 'http://localhost:3000'],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-correlation-id',
    exposedHeaders: 'x-correlation-id',
  });

  // 3. Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter(auditService));
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // 5. Global Rate Limiter
  app.useGlobalGuards(new RateLimitGuard(valkeyService));

  // 6. OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise Full-Stack Monorepo REST API')
    .setDescription(
      'Multi-tenant REST API with RBAC, PostgreSQL (Prisma), MongoDB (Mongoose), and Valkey cache',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Users Management')
    .addTag('Role & Permission Management')
    .addTag('Dynamic Navigation & Sidebar')
    .addTag('Audit & Error Logs')
    .addTag('User Activity Logs')
    .addTag('Default Settings')
    .addTag('System Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`🚀 API Server running at http://localhost:${port}/api`);
  logger.log(`📚 Swagger Documentation active at http://localhost:${port}/docs`);
}

bootstrap();
