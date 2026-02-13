import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { EquipamientoController } from './controllers/equipamiento.controller';

// Domain
import { EQUIPAMIENTO_REPOSITORY } from './domain/equipamiento.repository.interface';
import { EquipamientoConfigService } from './domain/equipamiento-config.service';

// Infrastructure
import { PrismaEquipamientoRepository } from './infrastructure/prisma-equipamiento.repository';

// Application
import { EquipamientoCommandHandlers } from './application/commands';
import { EquipamientoQueryHandlers } from './application/queries';
import { EquipamientoEventHandlers } from './application/events';

// Related modules
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CuadresModule } from '../cuadres/cuadres.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/**
 * Gestiona:
 * - Solicitud de equipamiento (vendedor)
 * - Activación/entrega de equipamiento (admin)
 * - Reporte de daños y pérdidas (admin)
 * - Devolución de equipamiento (admin)
 *
 * Las deudas de equipamiento se integran con el módulo de cuadres:
 * - Mensualidades pendientes
 * - Deudas por daños
 * - Deudas por pérdida
 *
 * INTEGRACIÓN CON CUADRES:
 * - Al reportar daño/pérdida, se actualiza automáticamente el montoEsperado
 *   de los cuadres activos del vendedor
 * - Usa ActualizadorCuadresVendedorService de CuadresModule
 *
 * INTEGRACIÓN CON NOTIFICACIONES:
 * - EQUIPAMIENTO_SOLICITADO: al vendedor (confirmación) y a admins (alerta)
 * - EQUIPAMIENTO_ENTREGADO: al vendedor cuando admin activa
 *
 * Configuración via .env:
 * - MENSUALIDAD_CON_DEPOSITO
 * - MENSUALIDAD_SIN_DEPOSITO
 * - DEPOSITO_EQUIPAMIENTO
 * - COSTO_DANO_NEVERA
 * - COSTO_DANO_PIJAMA
 */
@Module({
  imports: [
    CqrsModule,
    ConfigModule, // necesario para EquipamientoConfigService (.env)
    forwardRef(() => UsuariosModule),
    forwardRef(() => CuadresModule),
    forwardRef(() => NotificacionesModule),
  ],
  controllers: [EquipamientoController],
  providers: [
    // Repository (hexagonal)
    {
      provide: EQUIPAMIENTO_REPOSITORY,
      useClass: PrismaEquipamientoRepository,
    },

    // Domain service
    EquipamientoConfigService,

    // CQRS
    ...EquipamientoCommandHandlers,
    ...EquipamientoQueryHandlers,
    ...EquipamientoEventHandlers,
  ],
  exports: [
    EQUIPAMIENTO_REPOSITORY,
    EquipamientoConfigService, // lo que realmente necesita otros módulos
  ],
})
export class EquipamientoModule {}