import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para eliminar una venta al mayor PENDIENTE
 */
export class EliminarVentaMayorCommand implements ICommand {
  constructor(
    public readonly ventaMayorId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando EliminarVentaMayor
 *
 * Solo elimina ventas en estado PENDIENTE.
 * No toca stock, lotes, cuadres ni ningún otro modelo.
 */
@CommandHandler(EliminarVentaMayorCommand)
export class EliminarVentaMayorHandler implements ICommandHandler<EliminarVentaMayorCommand> {
  private readonly logger = new Logger(EliminarVentaMayorHandler.name);

  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
  ) {}

  async execute(command: EliminarVentaMayorCommand): Promise<void> {
    const { ventaMayorId, adminId } = command;

    const venta = await this.ventaMayorRepository.findById(ventaMayorId);
    if (!venta) {
      throw new DomainException('VMA_005', 'Venta al mayor no encontrada', { ventaMayorId });
    }

    if (venta.estado !== 'PENDIENTE') {
      throw new DomainException(
        'VMA_007',
        'Solo se pueden eliminar ventas al mayor en estado PENDIENTE',
        { estadoActual: venta.estado },
      );
    }

    await this.ventaMayorRepository.delete(ventaMayorId);

    this.logger.log(`Venta al mayor eliminada: ${ventaMayorId} - Admin: ${adminId}`);
  }
}
