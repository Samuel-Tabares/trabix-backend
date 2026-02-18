import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IVentaRepository, VENTA_REPOSITORY } from '../../domain/venta.repository.interface';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../../../lotes/domain/tanda.repository.interface';
import { VentaEntity } from '../../domain/venta.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para rechazar una venta
 */
export class RechazarVentaCommand implements ICommand {
  constructor(
    public readonly ventaId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando RechazarVenta
 * Según sección 6.2 del documento
 *
 * Si RECHAZA:
 * - Stock se revierte automáticamente
 * - Se elimina totalmente
 * - No genera efectos contables
 */
@CommandHandler(RechazarVentaCommand)
export class RechazarVentaHandler implements ICommandHandler<
  RechazarVentaCommand,
  { message: string }
> {
  private readonly logger = new Logger(RechazarVentaHandler.name);

  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
  ) {}

  async execute(command: RechazarVentaCommand): Promise<{ message: string }> {
    const { ventaId, adminId } = command;

    // Buscar la venta
    const venta = await this.ventaRepository.findById(ventaId);
    if (!venta) {
      throw new DomainException('VNT_004', 'Venta no encontrada', { ventaId });
    }

    // Validar que se puede rechazar
    const ventaEntity = new VentaEntity({
      ...venta,
      montoTotal: venta.montoTotal,
      detalles: [],
    });
    ventaEntity.validarRechazo();

    // 1. Revertir el stock que se había reducido temporalmente
    const tanda = await this.tandaRepository.findById(venta.tandaId);
    if (tanda) {
      await this.tandaRepository.actualizarStock(
        venta.tandaId,
        tanda.stockActual + venta.cantidadTrabix,
      );
    }

    // 2. Eliminar la venta (según documento: "Se elimina totalmente")
    await this.ventaRepository.delete(ventaId);

    this.logger.log(
      `Venta rechazada y eliminada: ${ventaId} por admin ${adminId}. Stock revertido: ${venta.cantidadTrabix} TRABIX`,
    );

    return {
      message: 'Venta rechazada exitosamente. Stock revertido.',
    };
  }
}
