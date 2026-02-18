import { IEvent, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IMiniCuadreRepository,
  MINI_CUADRE_REPOSITORY,
} from '../../domain/mini-cuadre.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import { CierreLoteService, LoteParaCierre } from '../../domain/cierre-lote.service';

/**
 * Evento: Stock de Última Tanda Agotado
 *
 * Trigger: Cuando el stock de la última tanda llega a 0
 * (ya sea por ventas normales o venta al mayor)
 *
 * Según sección 9.4: Se marca PENDIENTE cuando el stock en casa
 * de la última tanda llega a 0.
 */
export class StockUltimaTandaAgotadoEvent implements IEvent {
  constructor(
    public readonly tandaId: string,
    public readonly loteId: string,
  ) {}
}

/**
 * Handler del evento StockUltimaTandaAgotado
 *
 * Activa el mini-cuadre correspondiente
 */
@EventsHandler(StockUltimaTandaAgotadoEvent)
export class StockUltimaTandaAgotadoHandler implements IEventHandler<StockUltimaTandaAgotadoEvent> {
  private readonly logger = new Logger(StockUltimaTandaAgotadoHandler.name);

  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly cierreLoteService: CierreLoteService,
  ) {}

  async handle(event: StockUltimaTandaAgotadoEvent): Promise<void> {
    this.logger.log(
      `Procesando StockUltimaTandaAgotadoEvent: Tanda ${event.tandaId} - Lote ${event.loteId}`,
    );

    try {
      // Buscar el mini-cuadre del lote
      const miniCuadre = await this.miniCuadreRepository.findByLoteId(event.loteId);

      if (!miniCuadre) {
        this.logger.warn(`Mini-cuadre no encontrado para lote ${event.loteId}`);
        return;
      }

      // Solo activar si está INACTIVO
      if (miniCuadre.estado !== 'INACTIVO') {
        this.logger.log(`Mini-cuadre ya está en estado ${miniCuadre.estado}`);
        return;
      }

      // Verificar que la tanda corresponde a la última tanda del mini-cuadre
      if (miniCuadre.tandaId !== event.tandaId) {
        this.logger.log(`La tanda ${event.tandaId} no es la última tanda del lote`);
        return;
      }

      // Obtener el lote para calcular el monto final
      const lote = await this.loteRepository.findById(event.loteId);
      if (!lote) {
        this.logger.error(`Lote no encontrado: ${event.loteId}`);
        return;
      }

      // Preparar datos del lote para el servicio de cierre
      const loteParaCierre: LoteParaCierre = {
        id: lote.id,
        dineroRecaudado: new Decimal(lote.dineroRecaudado.toString()),
        dineroTransferido: new Decimal(lote.dineroTransferido.toString()),
        inversionAdmin: new Decimal(lote.inversionAdmin.toString()),
        inversionVendedor: new Decimal(lote.inversionVendedor.toString()),
      };

      // Calcular monto final (ganancias restantes)
      const { montoFinal, hayGananciasRestantes } =
        this.cierreLoteService.calcularMontoFinal(loteParaCierre);

      // Activar el mini-cuadre (INACTIVO → PENDIENTE)
      await this.miniCuadreRepository.activar(miniCuadre.id, montoFinal);

      this.logger.log(
        `Mini-cuadre activado: ${miniCuadre.id} - ` +
          `Monto final: $${montoFinal.toFixed(2)} - ` +
          `Hay ganancias restantes: ${hayGananciasRestantes}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando StockUltimaTandaAgotadoEvent: ${event.tandaId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
