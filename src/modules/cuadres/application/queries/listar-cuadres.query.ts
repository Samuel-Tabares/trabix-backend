import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICuadreRepository, CUADRE_REPOSITORY } from '../../domain/cuadre.repository.interface';
import { CuadresPaginadosDto } from '../dto/cuadre-response.dto';
import { QueryCuadresDto } from '../dto/query-cuadres.dto';
import { CuadreMapper } from '../dto/cuadre.mapper';

/**
 * Query para listar cuadres con filtros y paginación
 */
export class ListarCuadresQuery implements IQuery {
  constructor(public readonly filtros: QueryCuadresDto) {}
}

/**
 * Handler de la query ListarCuadres
 */
@QueryHandler(ListarCuadresQuery)
export class ListarCuadresHandler implements IQueryHandler<
  ListarCuadresQuery,
  CuadresPaginadosDto
> {
  constructor(
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
  ) {}

  async execute(query: ListarCuadresQuery): Promise<CuadresPaginadosDto> {
    const { filtros } = query;

    const resultado = await this.cuadreRepository.findAll({
      skip: filtros.skip,
      take: filtros.take,
      cursor: filtros.cursor,
      where: {
        loteId: filtros.loteId,
        vendedorId: filtros.vendedorId,
        estado: filtros.estado,
        concepto: filtros.concepto,
      },
    });

    return {
      data: resultado.data.map((cuadre) => CuadreMapper.toResponseDto(cuadre)),
      total: resultado.total,
      hasMore: resultado.hasMore,
      nextCursor: resultado.nextCursor,
    };
  }
}
