import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { CuadresMayorController } from './controllers/cuadres-mayor.controller';

// Domain
import { EvaluadorFinancieroMayorService } from './domain/evaluador-financiero-mayor.service';
import { CUADRE_MAYOR_REPOSITORY } from './domain/cuadre-mayor.repository.interface';

// Infrastructure
import { PrismaCuadreMayorRepository } from './infrastructure/prisma-cuadre-mayor.repository';

// Application
import { CuadreMayorCommandHandlers } from './application/commands';
import { CuadreMayorQueryHandlers } from './application/queries';
import { CuadreMayorEventHandlers } from './application/events';

// Related modules
import { LotesModule } from '../lotes/lotes.module';
import { CuadresModule } from '../cuadres/cuadres.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FondoRecompensasModule } from '../fondo-recompensas/fondo-recompensas.module';

/**
 * Responsabilidades:
 * - Gestión de cuadres al mayor (ventas mayoristas)
 * - Evaluación financiera completa
 * - Cierre automático de cuadres normales
 * - Gestión de lotes forzados
 * - Distribución de ganancias con jerarquía de reclutadores
 *
 * Estados de cuadre al mayor:
 * - PENDIENTE: registrado, esperando confirmación
 * - EXITOSO: admin confirmó la operación
 */
@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    forwardRef(() => LotesModule),
    forwardRef(() => CuadresModule),
    forwardRef(() => UsuariosModule),
    forwardRef(() => NotificacionesModule),
    forwardRef(() => FondoRecompensasModule),
  ],
  controllers: [CuadresMayorController],
  providers: [
    // Repository (hexagonal)
    {
      provide: CUADRE_MAYOR_REPOSITORY,
      useClass: PrismaCuadreMayorRepository,
    },

    // Domain service
    EvaluadorFinancieroMayorService,

    // CQRS
    ...CuadreMayorCommandHandlers,
    ...CuadreMayorQueryHandlers,
    ...CuadreMayorEventHandlers,
  ],
  exports: [
    CUADRE_MAYOR_REPOSITORY,
    EvaluadorFinancieroMayorService,
  ],
})
export class CuadresMayorModule {}