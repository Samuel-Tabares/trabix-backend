import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IVentaRepository, VENTA_REPOSITORY } from '../../domain/venta.repository.interface';
import { TRABIX_POR_TIPO } from '../../domain/calculadora-precios-venta.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { VentaResponseDto, DetalleVentaResponseDto } from '../dto/venta-response.dto';

/**
 * Query para obtener una venta por ID
 */
export class ObtenerVentaQuery implements IQuery {
  constructor(public readonly ventaId: string) {}
}

/**
 * Handler de la query ObtenerVenta
 */
@QueryHandler(ObtenerVentaQuery)
export class ObtenerVentaHandler implements IQueryHandler<ObtenerVentaQuery, VentaResponseDto> {
  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
  ) {}

  async execute(query: ObtenerVentaQuery): Promise<VentaResponseDto> {
    const { ventaId } = query;

    const venta = await this.ventaRepository.findById(ventaId);
    if (!venta) {
      throw new DomainException('VNT_003', 'Venta no encontrada', { ventaId });
    }

    return this.mapToDto(venta);
  }

  private mapToDto(venta: any): VentaResponseDto {
    const detalles: DetalleVentaResponseDto[] = venta.detalles.map((d: any) => ({
      id: d.id,
      ventaId: d.ventaId,
      tipo: d.tipo,
      cantidad: d.cantidad,
      precioUnitario: Number.parseFloat(d.precioUnitario),
      subtotal: Number.parseFloat(d.subtotal),
      trabixConsumidos: d.cantidad * TRABIX_POR_TIPO[d.tipo as keyof typeof TRABIX_POR_TIPO],
    }));

    const cantidadRegalos = detalles
      .filter((d) => d.tipo === 'REGALO')
      .reduce((sum, d) => sum + d.cantidad, 0);

    return {
      id: venta.id,
      vendedorId: venta.vendedorId,
      vendedorNombre: venta.vendedor?.nombre,
      vendedorTelefono: venta.vendedor?.telefono,
      loteId: venta.loteId,
      tandaId: venta.tandaId,
      estado: venta.estado,
      montoTotal: Number.parseFloat(venta.montoTotal),
      cantidadTrabix: venta.cantidadTrabix,
      detalles,
      fechaRegistro: venta.fechaRegistro,
      fechaValidacion: venta.fechaValidacion,
      cantidadRegalos,
    };
  }
}
