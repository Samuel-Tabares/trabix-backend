import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { DashboardController } from '../admin/controllers/dashboard.controller';
import {
  StockAdminController,
  PedidosStockController,
} from '../admin/controllers/stock.controller';
import {
  ConfiguracionesController,
  TiposInsumoController,
} from '../admin/controllers/configuraciones.controller';

// Domain
import {
  PEDIDO_STOCK_REPOSITORY,
  CONFIGURACION_REPOSITORY,
  TIPO_INSUMO_REPOSITORY,
  STOCK_ADMIN_REPOSITORY,
} from '../admin/domain/repositories';

// Infrastructure
import {
  PrismaPedidoStockRepository,
  PrismaConfiguracionRepository,
  PrismaTipoInsumoRepository,
  PrismaStockAdminRepository,
} from '../admin/infrastructure';

// Application
import { AdminCommandHandlers } from '../admin/application/commands';
import { AdminQueryHandlers } from '../admin/application/queries';

/**
 * Gestiona:
 * - Pedidos de stock (CRUD completo con costos)
 * - Configuraciones del sistema (con historial)
 * - Tipos de insumo (obligatorios y adicionales)
 * - Stock del admin (físico, reservado, déficit)
 * - Dashboard con métricas
 */
@Module({
  imports: [CqrsModule],
  controllers: [
    StockAdminController,
    PedidosStockController,
    ConfiguracionesController,
    TiposInsumoController,
    DashboardController,
  ],
  providers: [
    {
      provide: PEDIDO_STOCK_REPOSITORY,
      useClass: PrismaPedidoStockRepository,
    },
    {
      provide: CONFIGURACION_REPOSITORY,
      useClass: PrismaConfiguracionRepository,
    },
    {
      provide: TIPO_INSUMO_REPOSITORY,
      useClass: PrismaTipoInsumoRepository,
    },
    {
      provide: STOCK_ADMIN_REPOSITORY,
      useClass: PrismaStockAdminRepository,
    },
    ...AdminCommandHandlers,
    ...AdminQueryHandlers,
  ],
  exports: [
    PEDIDO_STOCK_REPOSITORY,
    CONFIGURACION_REPOSITORY,
    TIPO_INSUMO_REPOSITORY,
    STOCK_ADMIN_REPOSITORY,
  ],
})
export class AdminModule {}