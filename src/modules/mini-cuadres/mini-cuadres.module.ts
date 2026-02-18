import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { MiniCuadresController } from './controllers/mini-cuadres.controller';

// Domain
import { CierreLoteService } from './domain/cierre-lote.service';
import { MINI_CUADRE_REPOSITORY } from './domain/mini-cuadre.repository.interface';

// Infrastructure
import { PrismaMiniCuadreRepository } from './infrastructure/prisma-mini-cuadre.repository';

// Application
import { MiniCuadreCommandHandlers } from './application/commands';
import { MiniCuadreQueryHandlers } from './application/queries';
import { MiniCuadreEventHandlers } from './application/events';

// Related modules
import { LotesModule } from '../lotes/lotes.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Responsabilidades:
 * - Activación automática cuando stock final llega a 0
 * - Confirmación administrativa del mini-cuadre
 * - Cierre definitivo del lote (estado FINALIZADO)
 *
 * Estados del mini-cuadre:
 * - INACTIVO → stock > 0
 * - PENDIENTE → stock = 0
 * - EXITOSO → consolidación confirmada
 */
@Module({
  imports: [CqrsModule, forwardRef(() => LotesModule), forwardRef(() => NotificacionesModule)],
  controllers: [MiniCuadresController],
  providers: [
    {
      provide: MINI_CUADRE_REPOSITORY,
      useClass: PrismaMiniCuadreRepository,
    },
    // Domain
    CierreLoteService,
    // CQRS
    ...MiniCuadreCommandHandlers,
    ...MiniCuadreQueryHandlers,
    ...MiniCuadreEventHandlers,
  ],
  exports: [MINI_CUADRE_REPOSITORY, CierreLoteService],
})
export class MiniCuadresModule {}
