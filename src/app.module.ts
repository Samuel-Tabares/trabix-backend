import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CqrsModule } from '@nestjs/cqrs';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD } from '@nestjs/core';

import { configuration, validationSchema } from './config';
import { winstonConfig } from './shared/utils/logger.util';

// Infrastructure modules
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { EventsModule } from './infrastructure/events/events.module';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module';

// Feature modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { LotesModule } from './modules/lotes/lotes.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { CuadresModule } from './modules/cuadres/cuadres.module';
import { VentasMayorModule } from './modules/ventas-mayor/ventas-mayor.module';
import { CuadresMayorModule } from './modules/cuadres-mayor/cuadres-mayor.module';
import { MiniCuadresModule } from './modules/mini-cuadres/mini-cuadres.module';
import { EquipamientoModule } from './modules/equipamiento/equipamiento.module';
import { FondoRecompensasModule } from './modules/fondo-recompensas/fondo-recompensas.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    WinstonModule.forRoot(winstonConfig),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'global',
          ttl: configService.get<number>('throttle.global.ttl', 60000),
          limit: configService.get<number>('throttle.global.limit', 100),
        },
        {
          name: 'login',
          ttl: configService.get<number>('throttle.login.ttl', 60000),
          limit: configService.get<number>('throttle.login.limit', 5),
        },
      ],
    }),

    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    ScheduleModule.forRoot(),

    CqrsModule,

    PrismaModule,
    CacheModule,
    QueueModule,
    EventsModule,
    SchedulerModule,

    HealthModule,
    AuthModule,
    UsuariosModule,
    LotesModule,
    VentasModule,
    CuadresModule,
    VentasMayorModule,
    CuadresMayorModule,
    MiniCuadresModule,
    EquipamientoModule,
    FondoRecompensasModule,
    NotificacionesModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
