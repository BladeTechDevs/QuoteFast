import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Request size limit ────────────────────────────────────────────────────
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  app.setGlobalPrefix('api');

  // ── Global validation ─────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Global exception filter ───────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS (restrictive) ────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : []),
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('QuoteFast API')
      .setDescription('API para gestión de cotizaciones profesionales')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`QuoteFast API running on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
}

bootstrap();
