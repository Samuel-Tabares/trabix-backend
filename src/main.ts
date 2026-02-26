// src/main.ts
/* eslint-disable unicorn/prefer-top-level-await */

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { createWinstonLogger } from './shared/utils/logger.util';

// Filters
import { HttpExceptionFilter } from './presentation/http/filters/http-exception.filter';
import { AllExceptionsFilter } from './presentation/http/filters/all-exceptions.filter';
import { DomainExceptionFilter } from './presentation/http/filters/domain-exception.filter';

// Interceptors
import { LoggingInterceptor } from './presentation/http/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from './presentation/http/interceptors/idempotency.interceptor';

// Services
import { RedisService } from './infrastructure/cache/redis.service';

async function bootstrap() {
  // Logger Winston para bootstrap
  const logger = createWinstonLogger();

  // Crear aplicación Nest
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const redisService = app.get(RedisService);

  /**
   * ===============================
   * Configuración general
   * ===============================
   */
  const apiPrefix = configService.get<string>('API_PREFIX')!;
  const nodeEnv = configService.get<string>('app.nodeEnv')!;
  const port = configService.get<number>('app.port')!;
  const apiVersion = configService.get<string>('API_VERSION', '1')!;

  app.setGlobalPrefix(apiPrefix);

  /**
   * ===============================
   * Versionamiento de API
   * ===============================
   */
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  /**
   * ===============================
   * Seguridad - Helmet
   * ===============================
   */
  const helmetConfig = configService.get<any>('security.helmet')!;

  // Cookie parser — necesario para leer HttpOnly cookies en los endpoints de auth
  app.use(cookieParser());
  app.use(helmet(helmetConfig));

  /**
   * ===============================
   * CORS
   * ===============================
   */
  const corsOrigin = configService.get<string>('security.corsOrigin')!;
  const corsConfig = configService.get<any>('security.cors')!;
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, server-to-server, etc.)
      if (!origin) return callback(null, true);
      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow any device on the local network (RFC 1918: 10.x, 172.16-31.x, 192.168.x) in non-production
      if (nodeEnv !== 'production' && /^http:\/\/(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: corsConfig.methods.split(','),
    allowedHeaders: corsConfig.headers.split(','),
    credentials: corsConfig.credentials,
  });

  /**
   * ===============================
   * ValidationPipe global
   * ===============================
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,
    }),
  );

  /**
   * ===============================
   * Filters globales
   * NestJS aplica filtros en orden INVERSO al registro:
   * el último registrado se ejecuta primero.
   * Orden de ejecución: DomainException → Http → All (específico → general)
   * ===============================
   */
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new HttpExceptionFilter(),
    new DomainExceptionFilter(),
  );

  /**
   * ===============================
   * Interceptors globales
   * ===============================
   */
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new IdempotencyInterceptor(reflector, redisService),
  );

  /**
   * ===============================
   * Swagger (no producción)
   * ===============================
   */
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TRABIX Backend API')
      .setDescription('API Backend para el sistema de gestión de ventas de granizados TRABIX.')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Health')
      .addTag('Auth')
      .addTag('Usuarios')
      .addTag('Lotes')
      .addTag('Tandas')
      .addTag('Ventas')
      .addTag('Ventas Mayor')
      .addTag('Cuadres')
      .addTag('Cuadres Mayor')
      .addTag('Mini-Cuadres')
      .addTag('Equipamiento')
      .addTag('Fondo Recompensas')
      .addTag('Notificaciones')
      .addTag('Admin')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`📚 Swagger disponible en http://localhost:${port}/docs`);
  }

  /**
   * ===============================
   * Start server
   * ===============================
   */
  await app.listen(port);

  logger.log(`🚀 TRABIX Backend corriendo en http://localhost:${port}/${apiPrefix}`);
  logger.log(`📊 Ambiente: ${nodeEnv}`);
}

bootstrap();
