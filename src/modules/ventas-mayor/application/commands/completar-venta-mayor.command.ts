import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import { VentaMayorEntity } from '../../domain/venta-mayor.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para completar una venta al mayor
 */
export class CompletarVentaMayorCommand implements ICommand {
  constructor(
    public readonly ventaMayorId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando CompletarVentaMayor
 */
@CommandHandler(CompletarVentaMayorCommand)
export class CompletarVentaMayorHandler implements ICommandHandler<CompletarVentaMayorCommand> {
  private readonly logger = new Logger(CompletarVentaMayorHandler.name);

  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
  ) {}

  async execute(command: CompletarVentaMayorCommand): Promise<any> {
    const { ventaMayorId, adminId } = command;

    // Buscar la venta
    const venta = await this.ventaMayorRepository.findById(ventaMayorId);
    if (!venta) {
      throw new DomainException('VMA_005', 'Venta al mayor no encontrada', {
        ventaMayorId,
      });
    }

    // Validar que se puede completar
    const ventaEntity = new VentaMayorEntity({
      id: venta.id,
      vendedorId: venta.vendedorId,
      cantidadUnidades: venta.cantidadUnidades,
      precioUnidad: venta.precioUnidad,
      ingresoBruto: venta.ingresoBruto,
      conLicor: venta.conLicor,
      modalidad: venta.modalidad,
      estado: venta.estado,
      fuentesStock:
        venta.fuentesStock?.map((f) => ({
          tandaId: f.tandaId,
          cantidadConsumida: f.cantidadConsumida,
          tipoStock: f.tipoStock as any,
        })) || [],
      lotesInvolucradosIds: venta.lotesInvolucrados?.map((l) => l.loteId) || [],
      loteForzadoId: null,
      fechaRegistro: venta.fechaRegistro,
      fechaCompletada: venta.fechaCompletada,
    });

    ventaEntity.validarCompletar();

    // Completar la venta
    const ventaCompletada = await this.ventaMayorRepository.completar(ventaMayorId);

    this.logger.log(`Venta al mayor completada: ${ventaMayorId} - Admin: ${adminId}`);

    return ventaCompletada;
  }
}
