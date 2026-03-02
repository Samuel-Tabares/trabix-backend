import { Module } from '@nestjs/common';
import {
  CleanupExpiredTokensJob,
  CleanupProcessedOutboxJob,
  CleanupExpiredIdempotencyKeysJob,
} from './jobs/cleanup.jobs';
import { MensualidadesVencidasJob } from './jobs/mensualidades-vencidas.job';
import { EventsModule } from '../events/events.module';
import { EquipamientoModule } from '../../modules/equipamiento/equipamiento.module';
import { CuadresModule } from '../../modules/cuadres/cuadres.module';

/**
 * SchedulerModule
 * Según sección 23 del documento: JOBS PROGRAMADOS (Bull + @nestjs/schedule)
 *
 * Jobs incluidos:
 *
 * 1. CleanupExpiredTokensJob
 *    - Frecuencia: cada 1 hora
 *    - Acción: elimina tokens expirados de TokenBlacklist
 *
 * 2. CleanupProcessedOutboxJob
 *    - Frecuencia: cada 24 horas
 *    - Acción: elimina eventos procesados con más de 7 días
 *
 * 3. CleanupExpiredIdempotencyKeysJob
 *    - Frecuencia: cada 1 hora
 *    - Acción: elimina idempotency keys expiradas
 *
 * 4. MensualidadesVencidasJob
 *    - Frecuencia: cada día a medianoche
 *    - Acción: detecta mensualidades de equipamiento vencidas (>30 días)
 *             y actualiza el montoEsperado de los cuadres activos
 *
 * IDEMPOTENCIA:
 * Todos los jobs verifican el estado actual antes de ejecutar para
 * evitar race conditions en ambientes con múltiples instancias.
 */
@Module({
  imports: [EventsModule, EquipamientoModule, CuadresModule],
  providers: [
    CleanupExpiredTokensJob,
    CleanupProcessedOutboxJob,
    CleanupExpiredIdempotencyKeysJob,
    MensualidadesVencidasJob,
  ],
  exports: [MensualidadesVencidasJob],
})
export class SchedulerModule {}
