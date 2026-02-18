import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  IMiniCuadreRepository,
  MINI_CUADRE_REPOSITORY,
} from '../../domain/mini-cuadre.repository.interface';
import { MiniCuadreEntity } from '../../domain/mini-cuadre.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { MiniCuadreExitosoEvent } from '../events/mini-cuadre-exitoso.event';

/**
 * Command para confirmar un mini-cuadre
 */
export class ConfirmarMiniCuadreCommand implements ICommand {
  constructor(
    public readonly miniCuadreId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ConfirmarMiniCuadre
 * Según sección 9 del documento
 *
 * Acciones (en transacción atómica):
 * 1. Marcar última tanda como FINALIZADA
 * 2. Marcar lote como FINALIZADO
 * 3. Confirmar mini-cuadre como EXITOSO
 *
 * Post-transacción:
 * 4. Publicar evento para notificar al vendedor
 */
@CommandHandler(ConfirmarMiniCuadreCommand)
export class ConfirmarMiniCuadreHandler implements ICommandHandler<ConfirmarMiniCuadreCommand> {
  private readonly logger = new Logger(ConfirmarMiniCuadreHandler.name);

  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConfirmarMiniCuadreCommand): Promise<any> {
    const { miniCuadreId } = command;

    // 1. Buscar el mini-cuadre con sus relaciones
    const miniCuadre = await this.miniCuadreRepository.findById(miniCuadreId);
    if (!miniCuadre) {
      throw new DomainException('MCU_003', 'Mini-cuadre no encontrado', {
        miniCuadreId,
      });
    }

    // 2. Validar que se puede confirmar (estado PENDIENTE)
    const miniCuadreEntity = new MiniCuadreEntity({
      id: miniCuadre.id,
      loteId: miniCuadre.loteId,
      tandaId: miniCuadre.tandaId,
      estado: miniCuadre.estado,
      montoFinal: miniCuadre.montoFinal,
      fechaPendiente: miniCuadre.fechaPendiente,
      fechaExitoso: miniCuadre.fechaExitoso,
    });
    miniCuadreEntity.validarConfirmacion();

    // 3. Ejecutar confirmación en transacción (tanda + lote + mini-cuadre)
    const resultado = await this.miniCuadreRepository.confirmarConFinalizacion(
      miniCuadreId,
      miniCuadre.tandaId,
      miniCuadre.loteId,
    );

    this.logger.log(
      `Mini-cuadre confirmado: ${miniCuadreId} - ` +
        `Tanda finalizada: ${resultado.tandaFinalizada} - ` +
        `Lote finalizado: ${resultado.loteFinalizado} - ` +
        `Monto final: $${Number.parseFloat(miniCuadre.montoFinal as any).toFixed(2)}`,
    );

    // 4. Publicar evento (fuera de la transacción)
    this.eventBus.publish(
      new MiniCuadreExitosoEvent(
        miniCuadreId,
        miniCuadre.loteId,
        miniCuadre.tandaId,
        miniCuadre.lote?.vendedorId || '',
        miniCuadre.montoFinal,
      ),
    );

    return resultado.miniCuadre;
  }
}
