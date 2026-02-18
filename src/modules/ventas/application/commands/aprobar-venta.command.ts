import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IVentaRepository,
  VENTA_REPOSITORY,
  VentaConDetalles,
} from '../../domain/venta.repository.interface';
import { VentaEntity } from '../../domain/venta.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { VentaAprobadaEvent } from '../events/venta-aprobada.event';

/**
 * Command para aprobar una venta
 */
export class AprobarVentaCommand implements ICommand {
  constructor(
    public readonly ventaId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando AprobarVenta
 * Según sección 6 del documento
 *
 * Si APRUEBA: stock se reduce definitivamente, venta genera recaudo
 *
 * Acciones (VentaAprobadaEvent):
 * 1. Actualizar stock de tanda (ya reducido temporalmente)
 * 2. Actualizar dinero recaudado del lote
 * 3. Verificar trigger de cuadre (dinero o %)
 * 4. Si stock <= 25%: Enviar notificación
 * 5. Si inversión recuperada: Enviar notificación
 */
@CommandHandler(AprobarVentaCommand)
export class AprobarVentaHandler implements ICommandHandler<AprobarVentaCommand, VentaConDetalles> {
  private readonly logger = new Logger(AprobarVentaHandler.name);

  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AprobarVentaCommand): Promise<VentaConDetalles> {
    const { ventaId, adminId } = command;

    // Buscar la venta
    const venta = await this.ventaRepository.findById(ventaId);
    if (!venta) {
      throw new DomainException('VNT_003', 'Venta no encontrada', { ventaId });
    }

    // Validar que se puede aprobar
    const ventaEntity = new VentaEntity({
      ...venta,
      montoTotal: venta.montoTotal,
      detalles: [],
    });
    ventaEntity.validarAprobacion();

    // Aprobar la venta
    const ventaAprobada = await this.ventaRepository.aprobar(ventaId);

    this.logger.log(`Venta aprobada: ${ventaId} por admin ${adminId}`);

    // Publicar evento VentaAprobadaEvent
    this.eventBus.publish(
      new VentaAprobadaEvent(
        ventaAprobada.id,
        ventaAprobada.vendedorId,
        ventaAprobada.loteId,
        ventaAprobada.tandaId,
        new Decimal(ventaAprobada.montoTotal),
        ventaAprobada.cantidadTrabix,
      ),
    );

    return ventaAprobada;
  }
}
