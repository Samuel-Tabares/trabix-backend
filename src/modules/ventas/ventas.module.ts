import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { VentasController } from './controllers/ventas.controller';

// Domain
import { VENTA_REPOSITORY } from './domain/venta.repository.interface';
import { VendedorPuedeVenderSpecification } from './domain/vendedor-puede-vender.specification';
import { RegaloPermitidoSpecification } from './domain/regalo-permitido.specification';
import { CalculadoraPreciosVentaService } from './domain/calculadora-precios-venta.service';

// Infrastructure
import { PrismaVentaRepository } from './infrastructure/prisma-venta.repository';

// Application
import { VentaCommandHandlers } from './application/commands';
import { VentaQueryHandlers } from './application/queries';
import { VentaEventHandlers } from './application/events';

// Related modules
import { UsuariosModule } from '../usuarios/usuarios.module';
import { LotesModule } from '../lotes/lotes.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CuadresModule } from '../cuadres/cuadres.module';

/**
 * Gestiona:
 * - Registro de ventas normales
 * - Aprobación/rechazo de ventas
 * - Cálculo de precios según tipo
 * - Integración con tandas y cuadres
 *
 * INTEGRACIÓN CON CUADRES:
 * - Al aprobar una venta, se actualiza el montoEsperado del cuadre
 * - Usa ActualizadorCuadresVendedorService para mantener sincronizado
 *
 * Tipos de venta:
 * - PROMO: $12,000
 * - UNIDAD: $8,000
 * - SIN_LICOR: $7,000
 * - REGALO: $0
 */
@Module({
    imports: [
        CqrsModule,
        ConfigModule,
        forwardRef(() => LotesModule),
        forwardRef(() => NotificacionesModule),
        forwardRef(() => CuadresModule),
        forwardRef(() => UsuariosModule),
    ],
    controllers: [VentasController],
    providers: [
        // Repository
        {
            provide: VENTA_REPOSITORY,
            useClass: PrismaVentaRepository,
        },
      VendedorPuedeVenderSpecification,
      RegaloPermitidoSpecification,
      CalculadoraPreciosVentaService,
        // Command Handlers
        ...VentaCommandHandlers,
        // Query Handlers
        ...VentaQueryHandlers,
        // Event Handlers
        ...VentaEventHandlers,
    ],
    exports: [
        VENTA_REPOSITORY,
    ],
})
export class VentasModule {}