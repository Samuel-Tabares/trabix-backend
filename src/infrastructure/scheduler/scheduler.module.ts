import { Module } from '@nestjs/common';
import {
  CleanupExpiredTokensJob,
  CleanupProcessedOutboxJob,
  CleanupExpiredIdempotencyKeysJob,
} from './jobs/cleanup.jobs';
import { TandaAutoTransitJob } from './jobs/tanda-auto-transit.job';
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
 * 1. TandaAutoTransitJob
 *    - Frecuencia: cada 5 minutos
 *    - Acción: transiciona tandas LIBERADA → EN_TRÁNSITO después de 2 horas
 *
 * 2. CleanupExpiredTokensJob
 *    - Frecuencia: cada 1 hora
 *    - Acción: elimina tokens expirados de TokenBlacklist
 *
 * 3. CleanupProcessedOutboxJob
 *    - Frecuencia: cada 24 horas
 *    - Acción: elimina eventos procesados con más de 7 días
 *
 * 4. CleanupExpiredIdempotencyKeysJob
 *    - Frecuencia: cada 1 hora
 *    - Acción: elimina idempotency keys expiradas
 *
 * 5. MensualidadesVencidasJob (NUEVO)
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
    TandaAutoTransitJob,
    CleanupExpiredTokensJob,
    CleanupProcessedOutboxJob,
    CleanupExpiredIdempotencyKeysJob,
    MensualidadesVencidasJob,
  ],
  exports: [TandaAutoTransitJob, MensualidadesVencidasJob],
})
export class SchedulerModule {}
