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

// ========== ListarMiniCuadresQuery ==========

export class ListarMiniCuadresQuery implements IQuery {
  constructor(
    /** undefined = admin (todos), vendedorId = solo del vendedor */
    public readonly vendedorId?: string,
  ) {}
}

@QueryHandler(ListarMiniCuadresQuery)
export class ListarMiniCuadresHandler implements IQueryHandler<
  ListarMiniCuadresQuery,
  MiniCuadreResponseDto[]
> {
  constructor(
    @Inject(MINI_CUADRE_REPOSITORY)
    private readonly miniCuadreRepository: IMiniCuadreRepository,
  ) {}

  async execute(query: ListarMiniCuadresQuery): Promise<MiniCuadreResponseDto[]> {
    let miniCuadres;

    if (query.vendedorId) {
      miniCuadres = await this.miniCuadreRepository.findByVendedorId(query.vendedorId);
    } else {
      // Admin: merge PENDIENTE + EXITOSO ordenados por fecha
      const [pendientes, exitosos] = await Promise.all([
        this.miniCuadreRepository.findByEstado('PENDIENTE'),
        this.miniCuadreRepository.findByEstado('EXITOSO'),
      ]);
      miniCuadres = [...pendientes, ...exitosos].sort((a, b) => {
        const dateA = a.fechaPendiente ? new Date(a.fechaPendiente).getTime() : 0;
        const dateB = b.fechaPendiente ? new Date(b.fechaPendiente).getTime() : 0;
        return dateB - dateA;
      });
    }

    return miniCuadres.map((mc) => ({
      id: mc.id,
      loteId: mc.loteId,
      tandaId: mc.tandaId,
      estado: mc.estado,
      montoFinal: Number.parseFloat(mc.montoFinal as any),
      fechaPendiente: mc.fechaPendiente,
      fechaExitoso: mc.fechaExitoso,
      lote: mc.lote,
    }));
  }
}

// Export handlers array
export const MiniCuadreQueryHandlers = [
  ObtenerMiniCuadrePorLoteHandler,
  ObtenerMiniCuadreHandler,
  ListarMiniCuadresHandler,
];
