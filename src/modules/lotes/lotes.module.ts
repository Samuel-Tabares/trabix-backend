import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { TandasController } from './controllers/tandas.controller';
import { LotesController } from './controllers/lotes.controller';

// Repositories
import { PrismaLoteRepository } from './infrastructure/prisma-lote.repository';
import { PrismaTandaRepository } from './infrastructure/prisma-tanda.repository';
import { LOTE_REPOSITORY } from './domain/lote.repository.interface';
import { TANDA_REPOSITORY } from './domain/tanda.repository.interface';

// Domain Services
import { CalculadoraInversionService } from './domain/calculadora-inversion.service';
import { CalculadoraTandasService } from './domain/calculadora-tandas.service';

// Commands
import { LoteCommandHandlers } from './application/commands';

// Queries
import { LoteQueryHandlers } from './application/queries';

// Events
import { LoteEventHandlers } from './application/events';

// Related modules
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CuadresModule } from '../cuadres/cuadres.module';
import { MiniCuadresModule } from '../mini-cuadres/mini-cuadres.module';
import { FondoRecompensasModule } from '../fondo-recompensas/fondo-recompensas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Gestiona:
 * - Solicitud y creación de lotes
 * - Activación de lotes (confirma pago)
 * - Cancelación de solicitudes
 * - División en tandas (2 para ≤50, 3 para >50)
 * - Cálculos de inversión (50/50)
 * - Transiciones de estado de tandas
 * - Resumen financiero
 *
 * INTEGRACIÓN EQUIPAMIENTO:
 * - Al activar lote, los cuadres incluyen deudas de equipamiento
 * - Usa CalculadoraMontoEsperadoService de CuadresModule
 *
 * Límites:
 * - Máximo 2 lotes en estado CREADO por vendedor
 * - Inversión mínima del vendedor: $20,000
 */
@Module({
  imports: [
    CqrsModule,
    forwardRef(() => UsuariosModule),
    forwardRef(() => CuadresModule),
    forwardRef(() => MiniCuadresModule),
    forwardRef(() => FondoRecompensasModule),
    forwardRef(() => NotificacionesModule),
  ],
  controllers: [LotesController, TandasController],
  providers: [
    // Repositories (hexagonal)
    {
      provide: LOTE_REPOSITORY,
      useClass: PrismaLoteRepository,
    },
    {
      provide: TANDA_REPOSITORY,
      useClass: PrismaTandaRepository,
    },

    // Domain services
    CalculadoraInversionService,
    CalculadoraTandasService,

    // CQRS
    ...LoteCommandHandlers,
    ...LoteQueryHandlers,
    ...LoteEventHandlers,
  ],
  exports: [
    LOTE_REPOSITORY,
    TANDA_REPOSITORY,
    CalculadoraInversionService,
    CalculadoraTandasService,
  ],
})
export class LotesModule {}
