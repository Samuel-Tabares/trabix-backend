import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { FondoRecompensasController } from './controllers';

// Domain
import { FondoRecompensasService, FONDO_RECOMPENSAS_REPOSITORY } from './domain';

// Infrastructure
import { PrismaFondoRecompensasRepository } from './infrastructure';

// Application
import { FondoRecompensasCommandHandlers } from './application/commands';
import { FondoRecompensasQueryHandlers } from './application/queries';
import { FondoRecompensasEventHandlers } from './application/events';

// Related modules
import { UsuariosModule } from '../usuarios/usuarios.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Gestiona:
 * - Consulta de saldo del fondo (todos los usuarios)
 * - Listado de transacciones (todos los usuarios)
 * - Registro de salidas/premios (solo admin)
 *
 * Las entradas se registran automáticamente al activar lotes
 * desde el LoteActivadoEvent en el módulo de lotes.
 *
 * Cálculo:
 * - Aporte por TRABIX = $200 (configurable)
 * - Al activar lote: entrada = cantidadTrabix × $200
 */
@Module({
  imports: [CqrsModule, forwardRef(() => UsuariosModule), forwardRef(() => NotificacionesModule)],
  controllers: [FondoRecompensasController],
  providers: [
    // Repository (hexagonal)
    {
      provide: FONDO_RECOMPENSAS_REPOSITORY,
      useClass: PrismaFondoRecompensasRepository,
    },

    // Domain service
    FondoRecompensasService,

    // CQRS
    ...FondoRecompensasCommandHandlers,
    ...FondoRecompensasQueryHandlers,
    ...FondoRecompensasEventHandlers,
  ],
  exports: [FONDO_RECOMPENSAS_REPOSITORY, FondoRecompensasService],
})
export class FondoRecompensasModule {}
