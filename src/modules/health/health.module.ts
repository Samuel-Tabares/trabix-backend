import { Module } from '@nestjs/common';
import { TerminusModule, PrismaHealthIndicator } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bull';
import { HealthController } from '../../presentation/http/controllers/health.controller';
import { RedisHealthIndicator } from './redis.health';
import { BullHealthIndicator } from './bull.health';

/**
 * Módulo de Health Checks
 * Según sección 20.1 del documento
 *
 * Proporciona endpoints para verificar el estado del sistema:
 * - Database (PostgreSQL via Prisma)
 * - Redis (Cache y sesiones)
 * - Bull Queues (Colas de trabajo)
 * - Memory (Uso de memoria)
 * - Disk (Espacio en disco)
 */
@Module({
  imports: [
    TerminusModule,
    // Importar las colas para el BullHealthIndicator
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'tanda-transitions' },
      { name: 'outbox' },
    ),
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, BullHealthIndicator, PrismaHealthIndicator],
  exports: [RedisHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}
