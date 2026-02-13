import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Domain
import {
  CalculadoraGananciasService,
  Modelo6040Strategy,
  Modelo5050CascadaStrategy,
} from './domain/calculadora-ganancias.service';
import { CalculadoraMontoEsperadoService } from './domain/calculadora-monto-esperado.service';
import { ActualizadorCuadresVendedorService } from './domain/actualizador-cuadres-vendedor.service';
import { CUADRE_REPOSITORY } from './domain/cuadre.repository.interface';

// Infrastructure
import { PrismaCuadreRepository } from './infrastructure/prisma-cuadre.repository';

// Application
import { CuadreCommandHandlers } from './application/commands';
import { CuadreQueryHandlers } from './application/queries';
import { CuadreEventHandlers } from './application/events';

// Controllers
import { CuadresController } from './controllers/cuadres.controller';

// Related modules
import { LotesModule } from '../lotes/lotes.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EquipamientoModule } from '../equipamiento/equipamiento.module';

/**
 * Responsabilidades:
 * - Gestión de cuadres normales
 * - Cálculo de ganancias (60/40 y 50/50 con cascada)
 * - Triggers automáticos de activación
 * - Confirmación de transferencias
 * - Liberación de tandas al confirmar exitoso
 * - Integración con deudas de equipamiento
 * - Actualización dinámica de montoEsperado
 *
 * Estados de cuadre:
 * - INACTIVO: aún no se cumple el trigger
 * - PENDIENTE: trigger cumplido, esperando transferencia
 * - EXITOSO: admin confirmó transferencia completa
 *
 * INTEGRACIÓN EQUIPAMIENTO:
 * - El monto esperado incluye deudas de equipamiento
 * - Al confirmar exitoso, se reducen las deudas
 * - Se registra el pago de mensualidad
 * - ActualizadorCuadresVendedorService mantiene sincronizado el montoEsperado
 *
 * Configuración:
 * - Los porcentajes de ganancias se configuran vía variables de entorno
 * - PORCENTAJE_GANANCIA_VENDEDOR_60_40, PORCENTAJE_GANANCIA_ADMIN_60_40
 * - PORCENTAJE_GANANCIA_VENDEDOR_50_50
 */
@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    forwardRef(() => LotesModule),
    forwardRef(() => NotificacionesModule),
    forwardRef(() => EquipamientoModule),
  ],
  controllers: [CuadresController],
  providers: [
    // Repository (hexagonal)
    {
      provide: CUADRE_REPOSITORY,
      useClass: PrismaCuadreRepository,
    },

    // Domain services
    Modelo6040Strategy,
    Modelo5050CascadaStrategy,
    CalculadoraGananciasService,
    CalculadoraMontoEsperadoService,
    ActualizadorCuadresVendedorService,

    // CQRS
    ...CuadreCommandHandlers,
    ...CuadreQueryHandlers,
    ...CuadreEventHandlers,
  ],
  exports: [
    CUADRE_REPOSITORY,
    CalculadoraGananciasService,
    CalculadoraMontoEsperadoService,
    ActualizadorCuadresVendedorService,
  ],
})
export class CuadresModule {}