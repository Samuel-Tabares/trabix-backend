import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IVentaRepository, VENTA_REPOSITORY } from '../../domain/venta.repository.interface';
import { TRABIX_POR_TIPO } from '../../domain/calculadora-precios-venta.service';
import { QueryVentasDto } from '../dto/query-ventas.dto';
import {
  VentasPaginadasDto,
  VentaResponseDto,
  DetalleVentaResponseDto,
} from '../dto/venta-response.dto';

/**
 * Query para listar ventas con filtros y paginación
 */
export class ListarVentasQuery implements IQuery {
  constructor(public readonly filtros: QueryVentasDto) {}
}

/**
 * Handler de la query ListarVentas
 */
@QueryHandler(ListarVentasQuery)
export class ListarVentasHandler implements IQueryHandler<ListarVentasQuery, VentasPaginadasDto> {
  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
  ) {}

  async execute(query: ListarVentasQuery): Promise<VentasPaginadasDto> {
    const { filtros } = query;

    const resultado = await this.ventaRepository.findAll({
      skip: filtros.skip,
      take: filtros.take,
      cursor: filtros.cursor,
      where: {
        vendedorId: filtros.vendedorId,
        loteId: filtros.loteId,
        tandaId: filtros.tandaId,
        estado: filtros.estado,
      },
      orderBy: {
        field: filtros.orderBy || 'fechaRegistro',
        direction: filtros.orderDirection || 'desc',
      },
    });

    const data: VentaResponseDto[] = resultado.data.map((venta) => this.mapToDto(venta));

    return {
      data,
      total: resultado.total,
      hasMore: resultado.hasMore,
      nextCursor: resultado.nextCursor,
    };
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
