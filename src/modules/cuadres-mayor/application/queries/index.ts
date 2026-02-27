import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  ICuadreMayorRepository,
  CUADRE_MAYOR_REPOSITORY,
} from '../../domain/cuadre-mayor.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { QueryCuadresMayorDto, CuadreMayorResponseDto, CuadresMayorPaginadosDto } from '../dto';
import { CuadreMayorMapper } from '../dto/cuadre-mayor.mapper';

// ========== ObtenerCuadreMayorQuery ==========

export class ObtenerCuadreMayorQuery implements IQuery {
  constructor(public readonly cuadreMayorId: string) {}
}

@QueryHandler(ObtenerCuadreMayorQuery)
export class ObtenerCuadreMayorHandler implements IQueryHandler<
  ObtenerCuadreMayorQuery,
  CuadreMayorResponseDto
> {
  constructor(
    @Inject(CUADRE_MAYOR_REPOSITORY)
    private readonly cuadreMayorRepository: ICuadreMayorRepository,
  ) {}

  async execute(query: ObtenerCuadreMayorQuery): Promise<CuadreMayorResponseDto> {
    const cuadre = await this.cuadreMayorRepository.findById(query.cuadreMayorId);
    if (!cuadre) {
      throw new DomainException('CMA_002', 'Cuadre al mayor no encontrado', {
        cuadreMayorId: query.cuadreMayorId,
      });
    }
    return CuadreMayorMapper.toResponseDto(cuadre);
  }
}

// ========== ListarCuadresMayorQuery ==========

export class ListarCuadresMayorQuery implements IQuery {
  constructor(public readonly filtros: QueryCuadresMayorDto) {}
}

@QueryHandler(ListarCuadresMayorQuery)
export class ListarCuadresMayorHandler implements IQueryHandler<
  ListarCuadresMayorQuery,
  CuadresMayorPaginadosDto
> {
  constructor(
    @Inject(CUADRE_MAYOR_REPOSITORY)
    private readonly cuadreMayorRepository: ICuadreMayorRepository,
  ) {}

  async execute(query: ListarCuadresMayorQuery): Promise<CuadresMayorPaginadosDto> {
    const resultado = await this.cuadreMayorRepository.findAll({
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
      data: resultado.data.map((c) => CuadreMayorMapper.toResponseDto(c)),
      total: resultado.total,
      hasMore: resultado.hasMore,
      nextCursor: resultado.nextCursor,
    };
  }
}

// Export handlers
export const CuadreMayorQueryHandlers = [ObtenerCuadreMayorHandler, ListarCuadresMayorHandler];
