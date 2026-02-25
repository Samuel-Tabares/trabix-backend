import { EventsHandler, IEventHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { VentaRegistradaEvent } from './venta-aprobada.event';
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
 * Handler del evento VentaRegistrada
 *
 * Acciones:
 * 1. Actualizar dinero recaudado del lote
 * 2. Actualizar montoEsperado del cuadre de la tanda
 * 3. Verificar trigger de cuadre (dinero o %)
 * 4. Si stock <= 25%: Enviar notificación STOCK_BAJO
 * 5. Si inversión recuperada: Enviar notificación INVERSION_RECUPERADA
 * 6. Si última tanda llega a 0: Publicar StockUltimaTandaAgotadoEvent
 */
@EventsHandler(VentaRegistradaEvent)
export class VentaRegistradaHandler implements IEventHandler<VentaRegistradaEvent> {
  private readonly logger = new Logger(VentaRegistradaHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly calculadoraTandas: CalculadoraTandasService,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
  ) {}

  async handle(event: VentaRegistradaEvent): Promise<void> {
    this.logger.log(
      `Procesando VentaRegistradaEvent: Venta ${event.ventaId}, ` +
        `Lote ${event.loteId}, Monto $${event.montoTotal.toFixed(2)}`,
    );

    try {
      await this.loteRepository.actualizarRecaudado(event.loteId, event.montoTotal);

      const contexto = await this.obtenerContexto(event);
      if (!contexto) return;

      const { lote, tanda, triggerResult, dineroRecaudado } = contexto;

      await this.actualizarMontoEsperadoCuadre(tanda.id);
      await this.manejarCuadre(triggerResult, tanda);
      await this.manejarStockBajo(triggerResult, tanda, event.vendedorId);
      await this.manejarInversionRecuperada(lote, dineroRecaudado, event);
      await this.manejarFinalizacionTanda(lote, tanda, event);

      this.logger.log(`VentaRegistradaEvent procesado exitosamente: ${event.ventaId}`);
    } catch (error) {
      // No re-throw: la venta ya está persistida en DB.
      // Si falla un efecto secundario se registra el error pero no se revierte la venta.
      this.logger.error(`Error procesando VentaRegistradaEvent: ${event.ventaId}`, error);
    }
  }

  private async obtenerContexto(event: VentaRegistradaEvent) {
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

  private async actualizarMontoEsperadoCuadre(tandaId: string): Promise<void> {
    try {
      const cuadre = await this.cuadreRepository.findByTandaId(tandaId);

      if (!cuadre) {
        this.logger.debug(`No hay cuadre para tanda ${tandaId}`);
        return;
      }

      const resultado = await this.actualizadorCuadres.actualizarPorVentaAprobada(cuadre.id);

      if (resultado?.actualizado) {
        this.logger.log(
          `MontoEsperado actualizado para cuadre ${cuadre.id}: ` +
            `$${resultado.montoAnterior.toFixed(2)} → $${resultado.montoNuevo.toFixed(2)}`,
        );
      }
    } catch (error) {
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
    event: VentaRegistradaEvent,
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
    event: VentaRegistradaEvent,
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
