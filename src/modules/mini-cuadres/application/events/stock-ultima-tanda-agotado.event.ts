import { IEvent, EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ModeloNegocio } from '@prisma/client';
import {
  IMiniCuadreRepository,
  MINI_CUADRE_REPOSITORY,
} from '../../domain/mini-cuadre.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../../cuadres/domain/cuadre.repository.interface';
import { CalculadoraMontoEsperadoService } from '../../../cuadres/domain/calculadora-monto-esperado.service';
import { MiniCuadreExitosoEvent } from './mini-cuadre-exitoso.event';

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
 * Calcula el monto del mini-cuadre usando la misma lógica que los cuadres
 * normales de tipo GANANCIAS: gananciaAdmin_total - gananciasYaPagadas.
 *
 * Esto garantiza que el mini-cuadre refleja exactamente las ganancias
 * restantes que le corresponden al admin, sin duplicar lo ya cobrado
 * en los cuadres de T1 y T2.
 */
@EventsHandler(StockUltimaTandaAgotadoEvent)
export class StockUltimaTandaAgotadoHandler implements IEventHandler<StockUltimaTandaAgotadoEvent> {
  private readonly logger = new Logger(StockUltimaTandaAgotadoHandler.name);

  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly calculadoraMontoEsperado: CalculadoraMontoEsperadoService,
    private readonly eventBus: EventBus,
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

      // Obtener el lote con todos sus datos financieros
      const lote = await this.loteRepository.findById(event.loteId);
      if (!lote) {
        this.logger.error(`Lote no encontrado: ${event.loteId}`);
        return;
      }

      // Calcular ganancias ya pagadas en cuadres EXITOSOS del mismo lote
      // (misma lógica que ActualizadorCuadresVendedorService.recalcularYActualizar)
      const cuadresDelLote = await this.cuadreRepository.findByLoteId(lote.id);
      const gananciasYaPagadas = cuadresDelLote
        .filter((c) => c.estado === 'EXITOSO')
        .reduce((suma, c) => {
          const desglose = c.desglose as { gananciasAdmin?: number } | null;
          return suma.plus(new Decimal(desglose?.gananciasAdmin ?? 0));
        }, new Decimal(0));

      // Calcular monto del mini-cuadre usando la misma lógica que GANANCIAS cuadres:
      // gananciaAdmin_restante = gananciaAdmin_total - gananciasYaPagadas
      // (incluye deuda equipamiento pendiente si la hubiera)
      const calculo = await this.calculadoraMontoEsperado.calcularMontoEsperadoActualizado({
        vendedorId: lote.vendedorId,
        dineroRecaudado: new Decimal(lote.dineroRecaudado.toString()),
        inversionTotal: new Decimal(lote.inversionTotal.toString()),
        inversionAdmin: new Decimal(lote.inversionAdmin.toString()),
        modeloNegocio: lote.modeloNegocio as ModeloNegocio,
        concepto: 'GANANCIAS',
        jerarquia: [],
        gananciasYaPagadas,
      });

      const montoFinal = calculo.montoTotal;
      // Usar mismo umbral de $1 que los cuadres normales para ignorar diferencias mínimas
      const hayGananciasRestantes = montoFinal.greaterThan(1);

      this.logger.log(
        `Mini-cuadre ${miniCuadre.id}: gananciasYaPagadas=$${gananciasYaPagadas.toFixed(2)}, ` +
          `montoFinal=$${montoFinal.toFixed(2)}, hayGananciasRestantes=${hayGananciasRestantes}`,
      );

      if (!hayGananciasRestantes) {
        // Scenario B: Todo ya fue transferido por cuadres → mini-cuadre auto-EXITOSO
        await this.miniCuadreRepository.confirmarConFinalizacion(
          miniCuadre.id,
          event.tandaId,
          event.loteId,
        );

        this.logger.log(
          `Mini-cuadre auto-confirmado como EXITOSO (monto $0): ${miniCuadre.id} - ` +
            `Todo el dinero ya fue transferido por cuadres anteriores`,
        );

        // Publicar evento para notificar al vendedor
        this.eventBus.publish(
          new MiniCuadreExitosoEvent(
            miniCuadre.id,
            event.loteId,
            event.tandaId,
            lote.vendedorId,
            new Decimal(0),
          ),
        );
      } else {
        // Scenario A: Hay ganancias restantes → activar para que admin confirme
        await this.miniCuadreRepository.activar(miniCuadre.id, montoFinal);

        this.logger.log(
          `Mini-cuadre activado: ${miniCuadre.id} - Monto final: $${montoFinal.toFixed(2)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error procesando StockUltimaTandaAgotadoEvent: ${event.tandaId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
