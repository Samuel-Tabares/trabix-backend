import { EventsHandler, IEventHandler, EventBus, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ModeloNegocio } from '@prisma/client';
import { CuadreExitosoEvent } from '../../../cuadres/application/events/cuadre-exitoso.event';
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
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Handler de CuadreExitosoEvent en el módulo de mini-cuadres
 *
 * Responsabilidad: Cuando se confirma un cuadre normal, verificar si ya es
 * momento de activar o auto-confirmar el mini-cuadre.
 *
 * Condiciones necesarias para proceder:
 *   1. Mini-cuadre en estado INACTIVO (no fue activado aún)
 *   2. No quedan cuadres PENDIENTES en el lote
 *   3. El stock de la última tanda es 0 (todos los trabix vendidos)
 *
 * Escenario A:
 *   El stock llegó a 0 ANTES de que el último cuadre fuera confirmado.
 *   StockUltimaTandaAgotadoHandler detectó que había cuadres PENDIENTES
 *   y no activó el mini-cuadre. Ahora que se confirma el último cuadre,
 *   este handler retoma el flujo.
 */
@EventsHandler(CuadreExitosoEvent)
export class CuadreExitosoParaMiniCuadreHandler implements IEventHandler<CuadreExitosoEvent> {
  private readonly logger = new Logger(CuadreExitosoParaMiniCuadreHandler.name);

  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly calculadoraMontoEsperado: CalculadoraMontoEsperadoService,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: CuadreExitosoEvent): Promise<void> {
    try {
      const miniCuadre = await this.miniCuadreRepository.findByLoteId(event.loteId);

      // Solo actuar cuando el mini-cuadre todavía no fue activado
      if (!miniCuadre || miniCuadre.estado !== 'INACTIVO') {
        return;
      }

      // Verificar si quedan cuadres PENDIENTES
      // (el cuadre actual ya fue marcado EXITOSO antes de publicar el evento)
      const cuadresDelLote = await this.cuadreRepository.findByLoteId(event.loteId);
      const hayPendientes = cuadresDelLote.some((c) => c.estado === 'PENDIENTE');
      if (hayPendientes) {
        return;
      }

      // Verificar que el stock de la última tanda sea 0
      const lote = await this.loteRepository.findById(event.loteId);
      if (!lote) return;

      const ultimaTanda = lote.tandas.find((t) => t.id === miniCuadre.tandaId);
      if (!ultimaTanda || (ultimaTanda as any).stockActual !== 0) {
        // Todavía hay trabix sin vender — StockUltimaTandaAgotadoEvent manejará el resto
        return;
      }

      this.logger.log(
        `Escenario A: todos los cuadres confirmados y última tanda sin stock. ` +
          `Procesando mini-cuadre ${miniCuadre.id}`,
      );

      // Calcular ganancias restantes (mismo algoritmo que cuadres de tipo GANANCIAS)
      const gananciasYaPagadas = cuadresDelLote
        .filter((c) => c.estado === 'EXITOSO')
        .reduce((suma, c) => {
          const desglose = c.desglose as { gananciasAdmin?: number } | null;
          return suma.plus(new Decimal(desglose?.gananciasAdmin ?? 0));
        }, new Decimal(0));

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

      this.logger.log(
        `Mini-cuadre ${miniCuadre.id}: gananciasYaPagadas=$${gananciasYaPagadas.toFixed(2)}, ` +
          `montoFinal=$${montoFinal.toFixed(2)}`,
      );

      if (!montoFinal.greaterThan(1)) {
        // Todo fue cubierto por los cuadres normales → auto-confirmar
        await this.miniCuadreRepository.confirmarConFinalizacion(
          miniCuadre.id,
          miniCuadre.tandaId,
          event.loteId,
        );

        this.logger.log(`Mini-cuadre auto-confirmado EXITOSO (Escenario A): ${miniCuadre.id}`);

        this.eventBus.publish(
          new MiniCuadreExitosoEvent(
            miniCuadre.id,
            event.loteId,
            miniCuadre.tandaId,
            event.vendedorId,
            new Decimal(0),
          ),
        );
      } else {
        // Quedan ganancias → activar para que admin confirme
        await this.miniCuadreRepository.activar(miniCuadre.id, montoFinal);

        this.logger.log(
          `Mini-cuadre activado tras cuadre exitoso: ${miniCuadre.id} - $${montoFinal.toFixed(2)}`,
        );

        try {
          await this.commandBus.execute(
            new EnviarNotificacionCommand(lote.vendedorId, 'CUADRE_PENDIENTE', {
              cuadreId: miniCuadre.id,
              montoEsperado: montoFinal.toNumber(),
              esMiniCuadre: true,
            }),
          );
        } catch (notifError) {
          this.logger.warn(`Error enviando notificación de mini-cuadre pendiente: ${notifError}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error en CuadreExitosoParaMiniCuadreHandler para lote ${event.loteId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
