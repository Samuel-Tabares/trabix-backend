import { CommandHandler, ICommandHandler, ICommand, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ILoteRepository, LOTE_REPOSITORY } from '../../domain/lote.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Command para cancelar un lote en estado CREADO
 */
export class CancelarLoteCommand implements ICommand {
  constructor(
    public readonly loteId: string,
    public readonly usuarioId: string,
    public readonly esAdmin: boolean,
  ) {}
}

/**
 * Handler del comando CancelarLote
 *
 * Solo se pueden cancelar lotes en estado CREADO.
 * Puede cancelar: el vendedor dueño del lote o un admin.
 */
@CommandHandler(CancelarLoteCommand)
export class CancelarLoteHandler implements ICommandHandler<
  CancelarLoteCommand,
  { message: string }
> {
  private readonly logger = new Logger(CancelarLoteHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: CancelarLoteCommand): Promise<{ message: string }> {
    const { loteId, usuarioId, esAdmin } = command;

    // 1. Buscar el lote
    const lote = await this.loteRepository.findById(loteId);
    if (!lote) {
      throw new DomainException('LOTE_003', 'Lote no encontrado', { loteId });
    }

    // 2. Validar que el lote está en estado CREADO
    if (lote.estado !== 'CREADO') {
      throw new DomainException(
        'LOTE_008',
        'Solo se pueden cancelar lotes en estado CREADO (pendientes de activación)',
        { estadoActual: lote.estado },
      );
    }

    // 3. Validar permisos: admin puede cancelar cualquiera, vendedor solo los suyos
    if (!esAdmin && lote.vendedorId !== usuarioId) {
      throw new DomainException('LOTE_009', 'No tiene permisos para cancelar este lote', {
        loteId,
      });
    }

    // 4. Guardar datos antes de eliminar para la notificación
    const vendedorId = lote.vendedorId;
    const cantidadTrabix = lote.cantidadTrabix;

    // 5. Eliminar el lote (hard delete ya que nunca fue activado)
    await this.loteRepository.cancelar(loteId);

    this.logger.log(`Lote cancelado: ${loteId} por usuario ${usuarioId} (admin: ${esAdmin})`);

    // 6. Si el admin rechaza, notificar al vendedor/reclutador
    if (esAdmin) {
      try {
        await this.commandBus.execute(
          new EnviarNotificacionCommand(vendedorId, 'LOTE_RECHAZADO', {
            loteId,
            cantidadTrabix,
          }),
        );
      } catch (notifError) {
        this.logger.warn(`Error enviando notificación LOTE_RECHAZADO: ${notifError}`);
      }
    }

    return { message: 'Lote cancelado exitosamente' };
  }
}
