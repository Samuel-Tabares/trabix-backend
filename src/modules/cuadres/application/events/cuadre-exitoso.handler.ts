import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CuadreExitosoEvent } from './cuadre-exitoso.event';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../../../lotes/domain/tanda.repository.interface';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Handler del evento CuadreExitoso
 * Según sección 23 del documento
 *
 * Acciones:
 * 1. Actualizar dinero transferido del lote
 * 2. Liberar siguiente tanda
 * 3. Enviar notificación al vendedor
 *
 * FIX: Lógica de negocio separada de notificaciones.
 * Las notificaciones están en try-catch individuales para no interrumpir el flujo.
 */
@EventsHandler(CuadreExitosoEvent)
export class CuadreExitosoHandler implements IEventHandler<CuadreExitosoEvent> {
  private readonly logger = new Logger(CuadreExitosoHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: CuadreExitosoEvent): Promise<void> {
    this.logger.log(
      `Procesando CuadreExitosoEvent: Cuadre ${event.cuadreId}, ` +
        `Tanda ${event.numeroTanda}, Lote ${event.loteId}`,
    );

    // ========== 1. LÓGICA DE NEGOCIO (puede lanzar errores) ==========

    // 1.1 Actualizar dinero transferido del lote
    await this.loteRepository.actualizarTransferido(event.loteId, event.montoRecibido);
    this.logger.log(`Dinero transferido actualizado: $${event.montoRecibido.toFixed(2)}`);

    // 1.2 Liberar siguiente tanda (si existe)
    const lote = await this.loteRepository.findById(event.loteId);
    if (!lote) {
      this.logger.error(`Lote no encontrado: ${event.loteId}`);
      return;
    }

    const siguienteNumeroTanda = event.numeroTanda + 1;
    const siguienteTanda = lote.tandas.find(
      (t) => t.numero === siguienteNumeroTanda && t.estado === 'INACTIVA',
    );

    if (siguienteTanda) {
      // Liberar la siguiente tanda
      await this.tandaRepository.liberar(siguienteTanda.id);
      this.logger.log(`Tanda ${siguienteNumeroTanda} liberada: ${siguienteTanda.id}`);

      // Enviar notificación TandaLiberada (no interrumpe flujo)
      try {
        await this.commandBus.execute(
          new EnviarNotificacionCommand(event.vendedorId, 'TANDA_LIBERADA', {
            loteId: event.loteId,
            numeroTanda: siguienteNumeroTanda,
            cantidad: siguienteTanda.stockInicial,
          }),
        );
      } catch (error) {
        this.logger.warn(
          `Error enviando notificación TANDA_LIBERADA para tanda ${siguienteNumeroTanda}: ${error}`,
        );
      }
    } else {
      this.logger.log(
        `No hay siguiente tanda para liberar (tanda ${event.numeroTanda} era la última activa)`,
      );
    }

    // ========== 2. NOTIFICACIONES (no interrumpen flujo) ==========

    // 2.1 Enviar notificación de cuadre exitoso al vendedor
    try {
      await this.commandBus.execute(
        new EnviarNotificacionCommand(event.vendedorId, 'CUADRE_EXITOSO', {
          cuadreId: event.cuadreId,
          tandaId: event.tandaId,
          montoTransferido: Number.parseFloat(event.montoRecibido.toFixed(2)),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Error enviando notificación CUADRE_EXITOSO para cuadre ${event.cuadreId}: ${error}`,
      );
    }

    this.logger.log(`CuadreExitosoEvent procesado exitosamente: ${event.cuadreId}`);
  }
}
