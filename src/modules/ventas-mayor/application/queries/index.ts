import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import { ConsumidorStockMayorService } from '../../domain/consumidor-stock-mayor.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { QueryVentasMayorDto } from '../dto/query-ventas-mayor.dto';
import {
  VentaMayorResponseDto,
  VentasMayorPaginadasDto,
  StockDisponibleResponseDto,
} from '../dto/venta-mayor-response.dto';
// ========== ObtenerVentaMayorQuery ==========

export class ObtenerVentaMayorQuery implements IQuery {
  constructor(public readonly ventaMayorId: string) {}
}

@QueryHandler(ObtenerVentaMayorQuery)
export class ObtenerVentaMayorHandler implements IQueryHandler<
  ObtenerVentaMayorQuery,
  VentaMayorResponseDto
> {
  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
  ) {}

  async execute(query: ObtenerVentaMayorQuery): Promise<VentaMayorResponseDto> {
    const venta = await this.ventaMayorRepository.findById(query.ventaMayorId);
    if (!venta) {
      throw new DomainException('VMA_005', 'Venta al mayor no encontrada', {
        ventaMayorId: query.ventaMayorId,
      });
    }
    return this.mapToDto(venta);
  }

  private mapToDto(venta: any): VentaMayorResponseDto {
    return {
      id: venta.id,
      vendedorId: venta.vendedorId,
      cantidadUnidades: venta.cantidadUnidades,
      precioUnidad: Number.parseFloat(venta.precioUnidad),
      ingresoBruto: Number.parseFloat(venta.ingresoBruto),
      conLicor: venta.conLicor,
      modalidad: venta.modalidad,
      estado: venta.estado,
      fuentesStock:
        venta.fuentesStock?.map((f: any) => ({
          tandaId: f.tandaId,
          cantidadConsumida: f.cantidadConsumida,
          tipoStock: f.tipoStock,
        })) || [],
      lotesInvolucradosIds: venta.lotesInvolucrados?.map((l: any) => l.loteId) || [],
      loteForzadoId: venta.cuadreMayor?.loteForzadoId || null,
      cuadreMayorId: venta.cuadreMayor?.id || null,
      fechaRegistro: venta.fechaRegistro,
      fechaCompletada: venta.fechaCompletada,
    };
  }
}

// ========== ListarVentasMayorQuery ==========

export class ListarVentasMayorQuery implements IQuery {
  constructor(public readonly filtros: QueryVentasMayorDto) {}
}

@QueryHandler(ListarVentasMayorQuery)
export class ListarVentasMayorHandler implements IQueryHandler<
  ListarVentasMayorQuery,
  VentasMayorPaginadasDto
> {
  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
  ) {}

  async execute(query: ListarVentasMayorQuery): Promise<VentasMayorPaginadasDto> {
    const resultado = await this.ventaMayorRepository.findAll({
      skip: query.filtros.skip,
      take: query.filtros.take,
      cursor: query.filtros.cursor,
      where: {
        vendedorId: query.filtros.vendedorId,
        estado: query.filtros.estado,
        modalidad: query.filtros.modalidad,
        searchVendedor: query.filtros.searchVendedor,
      },
    });

    return {
      data: resultado.data.map((v) => this.mapToDto(v)),
      total: resultado.total,
      hasMore: resultado.hasMore,
      nextCursor: resultado.nextCursor,
    };
  }

  private mapToDto(venta: any): VentaMayorResponseDto {
    return {
      id: venta.id,
      vendedorId: venta.vendedorId,
      cantidadUnidades: venta.cantidadUnidades,
      precioUnidad: Number.parseFloat(venta.precioUnidad),
      ingresoBruto: Number.parseFloat(venta.ingresoBruto),
      conLicor: venta.conLicor,
      modalidad: venta.modalidad,
      estado: venta.estado,
      fuentesStock:
        venta.fuentesStock?.map((f: any) => ({
          tandaId: f.tandaId,
          cantidadConsumida: f.cantidadConsumida,
          tipoStock: f.tipoStock,
        })) || [],
      lotesInvolucradosIds: venta.lotesInvolucrados?.map((l: any) => l.loteId) || [],
      loteForzadoId: venta.cuadreMayor?.loteForzadoId || null,
      cuadreMayorId: venta.cuadreMayor?.id || null,
      fechaRegistro: venta.fechaRegistro,
      fechaCompletada: venta.fechaCompletada,
    };
  }
}

// ========== CalcularStockDisponibleQuery ==========

export class CalcularStockDisponibleQuery implements IQuery {
  constructor(public readonly vendedorId: string) {}
}

@QueryHandler(CalcularStockDisponibleQuery)
export class CalcularStockDisponibleHandler implements IQueryHandler<
  CalcularStockDisponibleQuery,
  StockDisponibleResponseDto
> {
  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly consumidorStock: ConsumidorStockMayorService,
  ) {}

  async execute(query: CalcularStockDisponibleQuery): Promise<StockDisponibleResponseDto> {
    const lotes = await this.loteRepository.findByVendedor(query.vendedorId);
    const lotesActivos = lotes.data.filter((l: any) => l.estado === 'ACTIVO');

    const stockDisponible = this.consumidorStock.calcularStockDisponible(
      lotesActivos.map((l: any) => ({
        id: l.id,
        cantidadTrabix: l.cantidadTrabix,
        estado: l.estado,
        fechaActivacion: l.fechaActivacion,
        tandas: l.tandas.map((t: any) => ({
          id: t.id,
          loteId: l.id,
          numero: t.numero,
          stockActual: t.stockActual,
          stockInicial: t.stockInicial,
          estado: t.estado,
        })),
      })),
    );

    return {
      stockReservado: stockDisponible.stockReservado,
      stockEnCasa: stockDisponible.stockEnCasa,
      stockTotal: stockDisponible.stockTotal,
      cantidadMaximaSinLoteForzado: stockDisponible.stockTotal,
    };
  }
}

// Export handlers array
export const VentaMayorQueryHandlers = [
  ObtenerVentaMayorHandler,
  ListarVentasMayorHandler,
  CalcularStockDisponibleHandler,
];
