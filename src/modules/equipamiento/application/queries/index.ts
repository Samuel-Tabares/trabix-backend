import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IEquipamientoRepository,
  EQUIPAMIENTO_REPOSITORY,
} from '../../domain/equipamiento.repository.interface';
import { EquipamientoEntity } from '../../domain/equipamiento.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import {
  QueryEquipamientosDto,
  EquipamientoResponseDto,
  EquipamientosPaginadosDto,
  ResumenDeudaEquipamientoDto,
} from '../dto';

// ========== ObtenerEquipamientoQuery ==========

export class ObtenerEquipamientoQuery implements IQuery {
  constructor(public readonly equipamientoId: string) {}
}

@QueryHandler(ObtenerEquipamientoQuery)
export class ObtenerEquipamientoHandler implements IQueryHandler<
  ObtenerEquipamientoQuery,
  EquipamientoResponseDto
> {
  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
  ) {}

  async execute(query: ObtenerEquipamientoQuery): Promise<EquipamientoResponseDto> {
    const equipamiento = await this.equipamientoRepository.findById(query.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }
    return this.mapToDto(equipamiento);
  }

  private mapToDto(equipamiento: any): EquipamientoResponseDto {
    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });

    return {
      id: equipamiento.id,
      vendedorId: equipamiento.vendedorId,
      vendedor: equipamiento.vendedor,
      estado: equipamiento.estado,
      tieneDeposito: equipamiento.tieneDeposito,
      depositoPagado: equipamiento.depositoPagado
        ? Number.parseFloat(equipamiento.depositoPagado)
        : null,
      mensualidadActual: Number.parseFloat(equipamiento.mensualidadActual),
      ultimaMensualidadPagada: equipamiento.ultimaMensualidadPagada,
      deudaDano: Number.parseFloat(equipamiento.deudaDano),
      deudaPerdida: Number.parseFloat(equipamiento.deudaPerdida),
      fechaSolicitud: equipamiento.fechaSolicitud,
      fechaEntrega: equipamiento.fechaEntrega,
      fechaDevolucion: equipamiento.fechaDevolucion,
      depositoDevuelto: equipamiento.depositoDevuelto,
      fechaDevolucionDeposito: equipamiento.fechaDevolucionDeposito,
      // Campos calculados
      mensualidadAlDia: entity.mensualidadAlDia(),
      diasMoraMensualidad: entity.diasMoraMensualidad(),
      mensualidadesPendientes: entity.mensualidadesPendientes(),
      montoMensualidadesPendientes: Number.parseFloat(
        entity.montoMensualidadesPendientes().toFixed(2),
      ),
      deudaTotal: Number.parseFloat(entity.deudaTotal.toFixed(2)),
      deudaTotalConMensualidades: Number.parseFloat(entity.deudaTotalConMensualidades().toFixed(2)),
      tieneDeuda: entity.tieneDeuda(),
    };
  }
}

// ========== ObtenerMiEquipamientoQuery ==========

export class ObtenerMiEquipamientoQuery implements IQuery {
  constructor(public readonly vendedorId: string) {}
}

@QueryHandler(ObtenerMiEquipamientoQuery)
export class ObtenerMiEquipamientoHandler implements IQueryHandler<
  ObtenerMiEquipamientoQuery,
  EquipamientoResponseDto | null
> {
  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
  ) {}

  async execute(query: ObtenerMiEquipamientoQuery): Promise<EquipamientoResponseDto | null> {
    // Buscar equipamiento activo o solicitado
    const equipamiento = await this.equipamientoRepository.findActivoByVendedorId(query.vendedorId);
    if (!equipamiento) {
      return null;
    }
    return this.mapToDto(equipamiento);
  }

  private mapToDto(equipamiento: any): EquipamientoResponseDto {
    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });

    return {
      id: equipamiento.id,
      vendedorId: equipamiento.vendedorId,
      estado: equipamiento.estado,
      tieneDeposito: equipamiento.tieneDeposito,
      depositoPagado: equipamiento.depositoPagado
        ? Number.parseFloat(equipamiento.depositoPagado)
        : null,
      mensualidadActual: Number.parseFloat(equipamiento.mensualidadActual),
      ultimaMensualidadPagada: equipamiento.ultimaMensualidadPagada,
      deudaDano: Number.parseFloat(equipamiento.deudaDano),
      deudaPerdida: Number.parseFloat(equipamiento.deudaPerdida),
      fechaSolicitud: equipamiento.fechaSolicitud,
      fechaEntrega: equipamiento.fechaEntrega,
      fechaDevolucion: equipamiento.fechaDevolucion,
      depositoDevuelto: equipamiento.depositoDevuelto,
      fechaDevolucionDeposito: equipamiento.fechaDevolucionDeposito,
      // Campos calculados
      mensualidadAlDia: entity.mensualidadAlDia(),
      diasMoraMensualidad: entity.diasMoraMensualidad(),
      mensualidadesPendientes: entity.mensualidadesPendientes(),
      montoMensualidadesPendientes: Number.parseFloat(
        entity.montoMensualidadesPendientes().toFixed(2),
      ),
      deudaTotal: Number.parseFloat(entity.deudaTotal.toFixed(2)),
      deudaTotalConMensualidades: Number.parseFloat(entity.deudaTotalConMensualidades().toFixed(2)),
      tieneDeuda: entity.tieneDeuda(),
    };
  }
}

// ========== ListarEquipamientosQuery ==========

export class ListarEquipamientosQuery implements IQuery {
  constructor(public readonly filtros: QueryEquipamientosDto) {}
}

@QueryHandler(ListarEquipamientosQuery)
export class ListarEquipamientosHandler implements IQueryHandler<
  ListarEquipamientosQuery,
  EquipamientosPaginadosDto
> {
  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
  ) {}

  async execute(query: ListarEquipamientosQuery): Promise<EquipamientosPaginadosDto> {
    const resultado = await this.equipamientoRepository.findAll({
      skip: query.filtros.skip,
      take: query.filtros.take,
      where: {
        estado: query.filtros.estado,
        vendedorId: query.filtros.vendedorId,
      },
    });

    return {
      data: resultado.data.map((e) => this.mapToDto(e)),
      total: resultado.total,
      hasMore: resultado.hasMore,
    };
  }

  private mapToDto(equipamiento: any): EquipamientoResponseDto {
    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano || 0,
      deudaPerdida: equipamiento.deudaPerdida || 0,
    });

    return {
      id: equipamiento.id,
      vendedorId: equipamiento.vendedorId,
      vendedor: equipamiento.vendedor,
      estado: equipamiento.estado,
      tieneDeposito: equipamiento.tieneDeposito,
      depositoPagado: equipamiento.depositoPagado
        ? Number.parseFloat(equipamiento.depositoPagado)
        : null,
      mensualidadActual: Number.parseFloat(equipamiento.mensualidadActual),
      ultimaMensualidadPagada: equipamiento.ultimaMensualidadPagada,
      deudaDano: Number.parseFloat(new Decimal(equipamiento.deudaDano || 0).toFixed(2)),
      deudaPerdida: Number.parseFloat(new Decimal(equipamiento.deudaPerdida || 0).toFixed(2)),
      fechaSolicitud: equipamiento.fechaSolicitud,
      fechaEntrega: equipamiento.fechaEntrega,
      fechaDevolucion: equipamiento.fechaDevolucion,
      depositoDevuelto: equipamiento.depositoDevuelto,
      fechaDevolucionDeposito: equipamiento.fechaDevolucionDeposito,
      // Campos calculados
      mensualidadAlDia: entity.mensualidadAlDia(),
      diasMoraMensualidad: entity.diasMoraMensualidad(),
      mensualidadesPendientes: entity.mensualidadesPendientes(),
      montoMensualidadesPendientes: Number.parseFloat(
        entity.montoMensualidadesPendientes().toFixed(2),
      ),
      deudaTotal: Number.parseFloat(entity.deudaTotal.toFixed(2)),
      deudaTotalConMensualidades: Number.parseFloat(entity.deudaTotalConMensualidades().toFixed(2)),
      tieneDeuda: entity.tieneDeuda(),
    };
  }
}

// ========== ObtenerDeudaEquipamientoQuery ==========
// Query especial para que el módulo de cuadres obtenga las deudas

export class ObtenerDeudaEquipamientoQuery implements IQuery {
  constructor(public readonly vendedorId: string) {}
}

@QueryHandler(ObtenerDeudaEquipamientoQuery)
export class ObtenerDeudaEquipamientoHandler implements IQueryHandler<
  ObtenerDeudaEquipamientoQuery,
  ResumenDeudaEquipamientoDto | null
> {
  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
  ) {}

  async execute(query: ObtenerDeudaEquipamientoQuery): Promise<ResumenDeudaEquipamientoDto | null> {
    // Buscar equipamiento activo del vendedor
    const equipamiento = await this.equipamientoRepository.findActivoByVendedorId(query.vendedorId);

    if (!equipamiento) {
      return null;
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });

    // Solo retornar si hay deuda
    if (!entity.tieneDeuda()) {
      return null;
    }

    return {
      equipamientoId: equipamiento.id,
      vendedorId: equipamiento.vendedorId,
      deudaDano: Number.parseFloat(entity.deudaDano.toFixed(2)),
      deudaPerdida: Number.parseFloat(entity.deudaPerdida.toFixed(2)),
      mensualidadesPendientes: entity.mensualidadesPendientes(),
      montoMensualidadesPendientes: Number.parseFloat(
        entity.montoMensualidadesPendientes().toFixed(2),
      ),
      deudaTotalParaCuadre: Number.parseFloat(entity.deudaTotalConMensualidades().toFixed(2)),
    };
  }
}

// Export handlers array
export const EquipamientoQueryHandlers = [
  ObtenerEquipamientoHandler,
  ObtenerMiEquipamientoHandler,
  ListarEquipamientosHandler,
  ObtenerDeudaEquipamientoHandler,
];
