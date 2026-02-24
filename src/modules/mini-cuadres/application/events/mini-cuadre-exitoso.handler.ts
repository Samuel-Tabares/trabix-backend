import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ModeloNegocio } from '@prisma/client';
import { MiniCuadreExitosoEvent } from './mini-cuadre-exitoso.event';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import { CalculadoraGananciasService } from '../../../cuadres/domain/calculadora-ganancias.service';

/**
 * Handler del evento MiniCuadreExitoso
 *
 * Acciones:
 * 1. Las acciones principales (finalizar tanda y lote) ya se ejecutaron en el command/handler
 * 2. Enviar notificación LOTE_FINALIZADO al vendedor con dineroRecaudado y gananciaVendedor
 */
@EventsHandler(MiniCuadreExitosoEvent)
export class MiniCuadreExitosoHandler implements IEventHandler<MiniCuadreExitosoEvent> {
  private readonly logger = new Logger(MiniCuadreExitosoHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly calculadoraGanancias: CalculadoraGananciasService,
  ) {}

  async handle(event: MiniCuadreExitosoEvent): Promise<void> {
    this.logger.log(
      `Procesando MiniCuadreExitosoEvent: ${event.miniCuadreId} - ` +
        `Lote: ${event.loteId} - Vendedor: ${event.vendedorId}`,
    );

    try {
      // Obtener datos del lote para la notificación
      let dineroRecaudado = 0;
      let gananciaVendedor = 0;

      const lote = await this.loteRepository.findById(event.loteId);
      if (lote) {
        dineroRecaudado = Number.parseFloat(lote.dineroRecaudado.toString());

        const resultado = this.calculadoraGanancias.calcularGanancias(
          new Decimal(lote.dineroRecaudado.toString()),
          new Decimal(lote.inversionTotal.toString()),
          lote.modeloNegocio as ModeloNegocio,
          [],
        );

        if (resultado.hayGanancias) {
          gananciaVendedor = resultado.gananciaVendedor.toNumber();
        }
      }

      await this.commandBus.execute(
        new EnviarNotificacionCommand(event.vendedorId, 'LOTE_FINALIZADO', {
          loteId: event.loteId,
          miniCuadreId: event.miniCuadreId,
          dineroRecaudado,
          gananciaVendedor,
        }),
      );

      this.logger.log(
        `MiniCuadreExitosoEvent procesado: ${event.miniCuadreId} - ` +
          `Lote ${event.loteId} FINALIZADO - ` +
          `dineroRecaudado=$${dineroRecaudado}, gananciaVendedor=$${gananciaVendedor}`,
      );
    } catch (error) {
      this.logger.error(`Error procesando MiniCuadreExitosoEvent: ${event.miniCuadreId}`, error);
      throw error;
    }
  }
}
