import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Módulo de colas Bull para procesamiento asíncrono
 * Según sección 18.1 del documento
 *
 * Colas disponibles:
 * - notifications: Procesamiento de notificaciones
 * - tanda-transitions: Transiciones automáticas de tandas
 * - outbox: Procesamiento de eventos del outbox pattern
 */
@Module({
  imports: [
    // Configuración global de Bull
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password', ''),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),

    // Cola de notificaciones
    BullModule.registerQueue({
      name: 'notifications',
    }),

    // Cola de transiciones de tandas
    BullModule.registerQueue({
      name: 'tanda-transitions',
    }),

    // Cola del outbox pattern
    BullModule.registerQueue({
      name: 'outbox',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
