import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { VentasMayorController } from './controllers/ventas-mayor.controller';

// Domain
import { ConsumidorStockMayorService } from './domain/consumidor-stock-mayor.service';
import { CalculadoraPreciosMayorService } from './domain/calculadora-precios-mayor.service';
import { VENTA_MAYOR_REPOSITORY } from './domain/venta-mayor.repository.interface';

// Infrastructure
import { PrismaVentaMayorRepository } from './infrastructure/prisma-venta-mayor.repository';

// Application
import { VentaMayorCommandHandlers } from './application/commands';
import { VentaMayorQueryHandlers } from './application/queries';
import { VentaMayorEventHandlers } from './application/events';

// Related modules
import { LotesModule } from '../lotes/lotes.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CuadresMayorModule } from '../cuadres-mayor/cuadres-mayor.module';
import { CuadresModule } from '../cuadres/cuadres.module';
import { EquipamientoModule } from '../equipamiento/equipamiento.module';

/**
 * Responsabilidades:
 * - Registro de ventas al mayor (>20 unidades)
 * - Cálculo de precios por rangos
 * - Consumo de stock de múltiples fuentes
 * - Generación de cuadres al mayor
 *
 * Los precios se cargan desde configuración para cada rango:
 * - 21-50 unidades
 * - 51-100 unidades
 * - 101+ unidades
 */
@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    forwardRef(() => LotesModule),
    forwardRef(() => UsuariosModule),
    forwardRef(() => CuadresMayorModule),
    forwardRef(() => CuadresModule),
    forwardRef(() => EquipamientoModule),
  ],
  controllers: [VentasMayorController],
  providers: [
    {
      provide: VENTA_MAYOR_REPOSITORY,
      useClass: PrismaVentaMayorRepository,
    },

    // Domain services
    ConsumidorStockMayorService,
    CalculadoraPreciosMayorService,

    // CQRS
    ...VentaMayorCommandHandlers,
    ...VentaMayorQueryHandlers,
    ...VentaMayorEventHandlers,
  ],
  exports: [
    VENTA_MAYOR_REPOSITORY,
    ConsumidorStockMayorService,
    CalculadoraPreciosMayorService,
  ],
})
export class VentasMayorModule {}