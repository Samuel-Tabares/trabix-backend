import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ILoteRepository, LOTE_REPOSITORY } from '../../domain/lote.repository.interface';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import { DomainException } from '@domain/exceptions/domain.exception';
import { LoteResponseDto, TandaResponseDto } from '../dto';

/**
 * Query para obtener un lote por ID
 */
export class ObtenerLoteQuery implements IQuery {
  constructor(public readonly loteId: string) {}
}

/**
 * Handler de la query ObtenerLote
 */
@QueryHandler(ObtenerLoteQuery)
export class ObtenerLoteHandler implements IQueryHandler<ObtenerLoteQuery, LoteResponseDto> {
  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
  ) {}

  async execute(query: ObtenerLoteQuery): Promise<LoteResponseDto> {
    const { loteId } = query;

    const lote = await this.loteRepository.findById(loteId);
    if (!lote) {
      throw new DomainException('LOTE_003', 'Lote no encontrado', { loteId });
    }

    return this.mapToDto(lote);
  }

  private mapToDto(lote: any): LoteResponseDto {
    const inversionTotal = new Decimal(lote.inversionTotal);
    const dineroRecaudado = new Decimal(lote.dineroRecaudado);
    const gananciaTotal = dineroRecaudado.minus(inversionTotal);

    const tandas: TandaResponseDto[] = lote.tandas.map((tanda: any) => ({
      id: tanda.id,
      loteId: tanda.loteId,
      numero: tanda.numero,
      estado: tanda.estado,
      stockInicial: tanda.stockInicial,
      stockActual: tanda.stockActual,
      stockConsumidoPorMayor: tanda.stockConsumidoPorMayor,
      porcentajeStockRestante:
        tanda.stockInicial > 0 ? (tanda.stockActual / tanda.stockInicial) * 100 : 0,
      fechaLiberacion: tanda.fechaLiberacion,
      fechaEnTransito: tanda.fechaEnTransito,
      fechaEnCasa: tanda.fechaEnCasa,
      fechaFinalizada: tanda.fechaFinalizada,
    }));

    // Usar CalculadoraInversionService para obtener el máximo de regalos
    const maximoRegalos = this.calculadoraInversion.calcularMaximoRegalos(lote.cantidadTrabix);

    return {
      id: lote.id,
      vendedorId: lote.vendedorId,
      cantidadTrabix: lote.cantidadTrabix,
      modeloNegocio: lote.modeloNegocio,
      estado: lote.estado,
      inversionTotal: Number.parseFloat(lote.inversionTotal),
      inversionAdmin: Number.parseFloat(lote.inversionAdmin),
      inversionVendedor: Number.parseFloat(lote.inversionVendedor),
      dineroRecaudado: Number.parseFloat(lote.dineroRecaudado),
      dineroTransferido: Number.parseFloat(lote.dineroTransferido),
      gananciaTotal: gananciaTotal.greaterThan(0) ? Number.parseFloat(gananciaTotal.toFixed(2)) : 0,
      porcentajeRecaudo: inversionTotal.isZero()
        ? 0
        : Number.parseFloat(dineroRecaudado.dividedBy(inversionTotal).times(100).toFixed(2)),
      inversionRecuperada: dineroRecaudado.greaterThanOrEqualTo(inversionTotal),
      esLoteForzado: lote.esLoteForzado,
      ventaMayorOrigenId: lote.ventaMayorOrigenId,
      numeroTandas: lote.tandas.length,
      maximoRegalos,
      tandas,
      fechaCreacion: lote.fechaCreacion,
      fechaActivacion: lote.fechaActivacion,
      fechaFinalizacion: lote.fechaFinalizacion,
    };
  }
}
