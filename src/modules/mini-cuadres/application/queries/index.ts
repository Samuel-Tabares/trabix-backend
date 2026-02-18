import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  IMiniCuadreRepository,
  MINI_CUADRE_REPOSITORY,
} from '../../domain/mini-cuadre.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { MiniCuadreResponseDto } from '../dto';

// ========== ObtenerMiniCuadrePorLoteQuery ==========

export class ObtenerMiniCuadrePorLoteQuery implements IQuery {
  constructor(public readonly loteId: string) {}
}

@QueryHandler(ObtenerMiniCuadrePorLoteQuery)
export class ObtenerMiniCuadrePorLoteHandler implements IQueryHandler<
  ObtenerMiniCuadrePorLoteQuery,
  MiniCuadreResponseDto
> {
  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
  ) {}

  async execute(query: ObtenerMiniCuadrePorLoteQuery): Promise<MiniCuadreResponseDto> {
    const miniCuadre = await this.miniCuadreRepository.findByLoteId(query.loteId);

    if (!miniCuadre) {
      throw new DomainException('MCU_004', 'Mini-cuadre no encontrado para el lote', {
        loteId: query.loteId,
      });
    }

    return {
      id: miniCuadre.id,
      loteId: miniCuadre.loteId,
      tandaId: miniCuadre.tandaId,
      estado: miniCuadre.estado,
      montoFinal: Number.parseFloat(miniCuadre.montoFinal as any),
      fechaPendiente: miniCuadre.fechaPendiente,
      fechaExitoso: miniCuadre.fechaExitoso,
      lote: miniCuadre.lote,
    };
  }
}

// ========== ObtenerMiniCuadreQuery ==========

export class ObtenerMiniCuadreQuery implements IQuery {
  constructor(public readonly miniCuadreId: string) {}
}

@QueryHandler(ObtenerMiniCuadreQuery)
export class ObtenerMiniCuadreHandler implements IQueryHandler<
  ObtenerMiniCuadreQuery,
  MiniCuadreResponseDto
> {
  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
  ) {}

  async execute(query: ObtenerMiniCuadreQuery): Promise<MiniCuadreResponseDto> {
    const miniCuadre = await this.miniCuadreRepository.findById(query.miniCuadreId);

    if (!miniCuadre) {
      throw new DomainException('MCU_003', 'Mini-cuadre no encontrado', {
        miniCuadreId: query.miniCuadreId,
      });
    }

    return {
      id: miniCuadre.id,
      loteId: miniCuadre.loteId,
      tandaId: miniCuadre.tandaId,
      estado: miniCuadre.estado,
      montoFinal: Number.parseFloat(miniCuadre.montoFinal as any),
      fechaPendiente: miniCuadre.fechaPendiente,
      fechaExitoso: miniCuadre.fechaExitoso,
      lote: miniCuadre.lote,
    };
  }
}

// Export handlers array
export const MiniCuadreQueryHandlers = [ObtenerMiniCuadrePorLoteHandler, ObtenerMiniCuadreHandler];
