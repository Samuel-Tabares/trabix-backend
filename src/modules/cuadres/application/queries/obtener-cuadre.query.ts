import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICuadreRepository, CUADRE_REPOSITORY } from '../../domain/cuadre.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { CuadreResponseDto } from '../dto/cuadre-response.dto';
import { CuadreMapper } from '../dto/cuadre.mapper';

/**
 * Query para obtener un cuadre por ID
 */
export class ObtenerCuadreQuery implements IQuery {
  constructor(public readonly cuadreId: string) {}
}

/**
 * Handler de la query ObtenerCuadre
 */
@QueryHandler(ObtenerCuadreQuery)
export class ObtenerCuadreHandler implements IQueryHandler<ObtenerCuadreQuery, CuadreResponseDto> {
  constructor(
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
  ) {}

  async execute(query: ObtenerCuadreQuery): Promise<CuadreResponseDto> {
    const { cuadreId } = query;

    const cuadre = await this.cuadreRepository.findById(cuadreId);
    if (!cuadre) {
      throw new DomainException('CUA_001', 'Cuadre no encontrado', { cuadreId });
    }

    return CuadreMapper.toResponseDto(cuadre);
  }
}
