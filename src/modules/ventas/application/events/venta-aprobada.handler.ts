import { EventsHandler, IEventHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { VentaAprobadaEvent } from './venta-aprobada.event';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../../../lotes/domain/tanda.repository.interface';
import { CalculadoraTandasService } from '../../../lotes/domain/calculadora-tandas.service';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../../cuadres/domain/cuadre.repository.interface';
import { ActualizadorCuadresVendedorService } from '../../../cuadres/domain/actualizador-cuadres-vendedor.service';
import { ActivarCuadreCommand } from '../../../cuadres/application/commands';
import { StockUltimaTandaAgotadoEvent } from '../../../mini-cuadres/application/events';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Handler del evento VentaAprobada
 * Según sección 23 del documento
 *
 * Acciones:
 * 1. Actualizar stock de tanda (ya reducido temporalmente, confirmar)
 * 2. Actualizar dinero recaudado del lote
 * 3. NUEVO: Actualizar montoEsperado del cuadre (ganancias + deuda equipamiento)
 * 4. Verificar trigger de cuadre (dinero o %)
 * 5. Si stock <= 25%: Enviar notificación
 * 6. Si inversión recuperada: Enviar notificación
 * 7. Si última tanda llega a 0: Activar mini-cuadre
 */
@EventsHandler(VentaAprobadaEvent)
export class VentaAprobadaHandler implements IEventHandler<VentaAprobadaEvent> {
  private readonly logger = new Logger(VentaAprobadaHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly calculadoraTandas: CalculadoraTandasService,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService, // NUEVO
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
  ) {}

  async handle(event: VentaAprobadaEvent): Promise<void> {
    this.logInicio(event);

    try {
      await this.loteRepository.actualizarRecaudado(event.loteId, event.montoTotal);

      const contexto = await this.obtenerContexto(event);
      if (!contexto) return;

      const { lote, tanda, triggerResult, dineroRecaudado } = contexto;

      // NUEVO: Actualizar montoEsperado del cuadre de esta tanda
      await this.actualizarMontoEsperadoCuadre(tanda.id);

      await this.manejarCuadre(triggerResult, tanda);
      await this.manejarStockBajo(triggerResult, tanda, event.vendedorId);
      await this.manejarInversionRecuperada(lote, dineroRecaudado, event);
      await this.manejarFinalizacionTanda(lote, tanda, event);

      this.logger.log(`VentaAprobadaEvent procesado exitosamente: ${event.ventaId}`);
    } catch (error) {
      // BUG-007 FIX: Do NOT re-throw. The venta is already APROBADA in the DB.
      // Re-throwing would propagate a 500 to the caller even though the command
      // succeeded, causing the admin to see an error on an already-approved venta.
      this.logger.error(`Error procesando VentaAprobadaEvent: ${event.ventaId}`, error);
    }
  }

  private logInicio(event: VentaAprobadaEvent): void {
    this.logger.log(
      `Procesando VentaAprobadaEvent: Venta ${event.ventaId}, ` +
        `Lote ${event.loteId}, Monto $${event.montoTotal.toFixed(2)}`,
    );
  }

  private async obtenerContexto(event: VentaAprobadaEvent) {
    const lote = await this.loteRepository.findById(event.loteId);
    const tanda = await this.tandaRepository.findById(event.tandaId);

    if (!lote || !tanda) {
      this.logger.error(`Lote o tanda no encontrados: ${event.loteId}, ${event.tandaId}`);
      return null;
    }

    const dineroRecaudado = new Decimal(lote.dineroRecaudado);
    const inversionAdmin = new Decimal(lote.inversionAdmin);

    const triggerResult = this.calculadoraTandas.verificarTriggerCuadre(
      tanda.numero,
      lote.tandas.length,
      tanda.stockActual,
      tanda.stockInicial,
      dineroRecaudado,
      inversionAdmin,
    );

    return { lote, tanda, triggerResult, dineroRecaudado };
  }

  /**
   * NUEVO: Actualiza el montoEsperado del cuadre cuando se aprueba una venta
   * Esto asegura que las ganancias se reflejen correctamente
   */
  private async actualizarMontoEsperadoCuadre(tandaId: string): Promise<void> {
    try {
      // Obtener el cuadre de esta tanda
      const cuadre = await this.cuadreRepository.findByTandaId(tandaId);

      if (!cuadre) {
        this.logger.debug(`No hay cuadre para tanda ${tandaId}`);
        return;
      }

      // Actualizar usando el servicio de actualización
      const resultado = await this.actualizadorCuadres.actualizarPorVentaAprobada(cuadre.id);

      if (resultado?.actualizado) {
        this.logger.log(
          `MontoEsperado actualizado para cuadre ${cuadre.id}: ` +
            `$${resultado.montoAnterior.toFixed(2)} → $${resultado.montoNuevo.toFixed(2)}`,
        );
      }
    } catch (error) {
      // Log del error pero no bloquear el flujo de la venta
      this.logger.error(`Error actualizando montoEsperado del cuadre: ${error}`);
    }
  }

  private async manejarCuadre(triggerResult: any, tanda: any): Promise<void> {
    if (!triggerResult.debeDisparar) return;

    this.logger.log(
      `Trigger de cuadre detectado para tanda ${tanda.numero}: ${triggerResult.razon}`,
    );

    const cuadre = await this.cuadreRepository.findByTandaId(tanda.id);
    if (cuadre?.estado === 'INACTIVO') {
      await this.commandBus.execute(new ActivarCuadreCommand(cuadre.id));
      this.logger.log(`Cuadre ${cuadre.id} activado para tanda ${tanda.numero}`);
    }
  }

  private async manejarStockBajo(
    triggerResult: any,
    tanda: any,
    vendedorId: string,
  ): Promise<void> {
    if (triggerResult.porcentajeStock > 25 || triggerResult.porcentajeStock <= 0) {
      return;
    }

    this.logger.log(
      `Stock bajo (${triggerResult.porcentajeStock.toFixed(1)}%) en tanda ${tanda.numero}`,
    );

    await this.commandBus.execute(
      new EnviarNotificacionCommand(vendedorId, 'STOCK_BAJO', {
        tandaId: tanda.id,
        porcentaje: triggerResult.porcentajeStock,
      }),
    );
  }

  private async manejarInversionRecuperada(
    lote: any,
    dineroRecaudado: Decimal,
    event: VentaAprobadaEvent,
  ): Promise<void> {
    const inversionTotal = new Decimal(lote.inversionTotal);

    if (!dineroRecaudado.greaterThanOrEqualTo(inversionTotal)) return;

    const seRecuperoAhora = new Decimal(lote.dineroRecaudado)
      .minus(event.montoTotal)
      .lessThan(inversionTotal);

    if (!seRecuperoAhora) return;

    this.logger.log(
      `¡Inversión recuperada! Lote ${event.loteId}: ` +
        `$${dineroRecaudado.toFixed(2)} >= $${inversionTotal.toFixed(2)}`,
    );

    await this.commandBus.execute(
      new EnviarNotificacionCommand(event.vendedorId, 'INVERSION_RECUPERADA', {
        loteId: event.loteId,
      }),
    );
  }

  private async manejarFinalizacionTanda(
    lote: any,
    tanda: any,
    event: VentaAprobadaEvent,
  ): Promise<void> {
    if (tanda.stockActual !== 0 || tanda.estado !== 'EN_CASA') return;

    const esUltimaTanda = tanda.numero === lote.tandas.length;

    if (!esUltimaTanda) {
      await this.tandaRepository.finalizar(tanda.id);
      this.logger.log(`Tanda ${tanda.numero} finalizada (stock agotado)`);
      return;
    }

    this.logger.log(`Última tanda ${tanda.numero} con stock 0. Activando mini-cuadre.`);
    this.eventBus.publish(new StockUltimaTandaAgotadoEvent(tanda.id, event.loteId));
  }
}
