import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CuadreMayorExitosoEvent } from './cuadre-mayor-exitoso.event';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Handler del evento CuadreMayorExitoso
 *
 * Acciones según sección 23:
 * 1. Enviar notificación al vendedor
 *
 * FIX: Notificación envuelta en try-catch sin re-throw
 * para no marcar el evento como fallido si solo falla la notificación.
 */
@EventsHandler(CuadreMayorExitosoEvent)
export class CuadreMayorExitosoHandler implements IEventHandler<CuadreMayorExitosoEvent> {
  private readonly logger = new Logger(CuadreMayorExitosoHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: CuadreMayorExitosoEvent): Promise<void> {
    this.logger.log(
      `Procesando CuadreMayorExitosoEvent: ${event.cuadreMayorId} - ` +
        `Vendedor: ${event.vendedorId} - ` +
        `Lotes: ${event.lotesInvolucradosIds.length} - ` +
        `Cuadres cerrados: ${event.cuadresCerradosIds.length}`,
    );

    // Enviar notificación al vendedor sobre el cuadre al mayor exitoso
    try {
      await this.commandBus.execute(
        new EnviarNotificacionCommand(event.vendedorId, 'CUADRE_EXITOSO', {
          cuadreMayorId: event.cuadreMayorId,
          lotesInvolucrados: event.lotesInvolucradosIds.length,
          cuadresCerrados: event.cuadresCerradosIds.length,
          esVentaAlMayor: true,
        }),
      );
    } catch (error) {
      // FIX: No re-lanzar el error; solo loguear
      this.logger.warn(
        `Error enviando notificación CUADRE_EXITOSO para cuadre mayor ${event.cuadreMayorId}: ${error}`,
      );
    }

    this.logger.log(`CuadreMayorExitosoEvent procesado: ${event.cuadreMayorId}`);
  }
}
