import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IFondoRecompensasRepository, FONDO_RECOMPENSAS_REPOSITORY } from '../../domain';
import { QueryTransaccionesDto, SaldoFondoResponseDto, TransaccionesPaginadasDto } from '../dto';

// ========== ObtenerSaldoFondoQuery ==========

/**
 * Query para obtener el saldo actual del fondo
 * Disponible para todos los usuarios autenticados
 */
export class ObtenerSaldoFondoQuery implements IQuery {}

@QueryHandler(ObtenerSaldoFondoQuery)
export class ObtenerSaldoFondoHandler implements IQueryHandler<
  ObtenerSaldoFondoQuery,
  SaldoFondoResponseDto
> {
  constructor(
    @Inject(FONDO_RECOMPENSAS_REPOSITORY)
    private readonly fondoRepository: IFondoRecompensasRepository,
  ) {}

  async execute(): Promise<SaldoFondoResponseDto> {
    const saldo = await this.fondoRepository.obtenerSaldo();
    return { saldo: Number.parseFloat(saldo.toFixed(2)) };
  }
}

// ========== ListarTransaccionesFondoQuery ==========

/**
 * Query para listar transacciones del fondo
 * Disponible para todos los usuarios autenticados
 */
export class ListarTransaccionesFondoQuery implements IQuery {
  constructor(public readonly filtros: QueryTransaccionesDto) {}
}

@QueryHandler(ListarTransaccionesFondoQuery)
export class ListarTransaccionesFondoHandler implements IQueryHandler<
  ListarTransaccionesFondoQuery,
  TransaccionesPaginadasDto
> {
  constructor(
    @Inject(FONDO_RECOMPENSAS_REPOSITORY)
    private readonly fondoRepository: IFondoRecompensasRepository,
  ) {}

  async execute(query: ListarTransaccionesFondoQuery): Promise<TransaccionesPaginadasDto> {
    const resultado = await this.fondoRepository.listarMovimientos({
      skip: query.filtros.skip,
      take: query.filtros.take,
      tipo: query.filtros.tipo,
    });

    return {
      data: resultado.data.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number.parseFloat(m.monto.toFixed(2)),
        concepto: m.concepto,
        loteId: m.loteId,
        vendedorBeneficiarioId: m.vendedorBeneficiarioId,
        fechaTransaccion: m.fechaTransaccion,
      })),
      total: resultado.total,
      hasMore: resultado.hasMore,
    };
  }
}

// Export handlers array
export const FondoRecompensasQueryHandlers = [
  ObtenerSaldoFondoHandler,
  ListarTransaccionesFondoHandler,
];
