import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';
import { ILoteRepository, LOTE_REPOSITORY } from '../../domain/lote.repository.interface';
import { CalculadoraInversionService } from '../../domain/calculadora-inversion.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { ResumenFinancieroDto } from '../dto';

/**
 * Query para obtener el resumen financiero de un lote
 */
export class ResumenFinancieroQuery implements IQuery {
  constructor(public readonly loteId: string) {}
}

/**
 * Handler de la query ResumenFinanciero
 * Calcula todas las métricas financieras del lote según sección 16 del documento
 */
@QueryHandler(ResumenFinancieroQuery)
export class ResumenFinancieroHandler implements IQueryHandler<
  ResumenFinancieroQuery,
  ResumenFinancieroDto
> {
  // Porcentajes de ganancia cargados desde configuración
  private readonly porcentajeVendedor6040: number;
  private readonly porcentajeAdmin6040: number;
  private readonly porcentajeVendedor5050: number;

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly configService: ConfigService,
  ) {
    // Cargar porcentajes desde configuración
    this.porcentajeVendedor6040 = this.configService.get<number>('porcentajes.vendedor6040') ?? 60;
    this.porcentajeAdmin6040 = this.configService.get<number>('porcentajes.admin6040') ?? 40;
    this.porcentajeVendedor5050 = this.configService.get<number>('porcentajes.vendedor5050') ?? 50;
  }

  async execute(query: ResumenFinancieroQuery): Promise<ResumenFinancieroDto> {
    const { loteId } = query;

    const lote = await this.loteRepository.findById(loteId);
    if (!lote) {
      throw new DomainException('LOTE_003', 'Lote no encontrado', { loteId });
    }

    const inversionTotal = new Decimal(lote.inversionTotal);
    const inversionAdmin = new Decimal(lote.inversionAdmin);
    const inversionVendedor = new Decimal(lote.inversionVendedor);
    const dineroRecaudado = new Decimal(lote.dineroRecaudado);
    const dineroTransferido = new Decimal(lote.dineroTransferido);

    // Calcular ganancia total
    const gananciaTotal = dineroRecaudado.minus(inversionTotal);
    const hayGanancia = gananciaTotal.greaterThan(0);

    // Calcular ganancias según modelo de negocio (usando configuración)
    let gananciaVendedor = new Decimal(0);
    let gananciaAdmin = new Decimal(0);

    if (hayGanancia) {
      if (lote.modeloNegocio === 'MODELO_60_40') {
        // Usar porcentajes de configuración
        gananciaVendedor = gananciaTotal.times(this.porcentajeVendedor6040 / 100);
        gananciaAdmin = gananciaTotal.times(this.porcentajeAdmin6040 / 100);
      } else {
        // MODELO_50_50 - Para cascada completa se necesita la jerarquía
        gananciaVendedor = gananciaTotal.times(this.porcentajeVendedor5050 / 100);
        // En el modelo 50/50, el otro 50% se distribuye en cascada
        // Por ahora simplificado sin cascada
        gananciaAdmin = gananciaTotal.times((100 - this.porcentajeVendedor5050) / 100);
      }
    }

    // Calcular stock
    let stockTotalDisponible = 0;
    let stockTotalVendido = 0;

    for (const tanda of lote.tandas) {
      stockTotalDisponible += tanda.stockActual;
      stockTotalVendido += tanda.stockInicial - tanda.stockActual;
    }

    // Calcular pendiente por transferir
    const pendientePorTransferir = dineroRecaudado.minus(dineroTransferido);

    // Porcentaje de recaudo
    const porcentajeRecaudo = inversionTotal.isZero()
      ? 0
      : dineroRecaudado.dividedBy(inversionTotal).times(100).toNumber();

    // Máximo de regalos (usando CalculadoraInversionService)
    const maximoRegalos = this.calculadoraInversion.calcularMaximoRegalos(lote.cantidadTrabix);

    // Contar regalos utilizados (solo ventas APROBADAS)
    const regalosUtilizados = await this.loteRepository.contarRegalosAprobados(loteId);

    return {
      loteId: lote.id,
      cantidadTrabix: lote.cantidadTrabix,
      modeloNegocio: lote.modeloNegocio,
      inversionTotal: Number.parseFloat(inversionTotal.toFixed(2)),
      inversionAdmin: Number.parseFloat(inversionAdmin.toFixed(2)),
      inversionVendedor: Number.parseFloat(inversionVendedor.toFixed(2)),
      dineroRecaudado: Number.parseFloat(dineroRecaudado.toFixed(2)),
      dineroTransferido: Number.parseFloat(dineroTransferido.toFixed(2)),
      pendientePorTransferir: Number.parseFloat(pendientePorTransferir.toFixed(2)),
      gananciaTotal: hayGanancia ? Number.parseFloat(gananciaTotal.toFixed(2)) : 0,
      gananciaVendedor: Number.parseFloat(gananciaVendedor.toFixed(2)),
      gananciaAdmin: Number.parseFloat(gananciaAdmin.toFixed(2)),
      porcentajeRecaudo: Number.parseFloat(porcentajeRecaudo.toFixed(2)),
      inversionRecuperada: dineroRecaudado.greaterThanOrEqualTo(inversionTotal),
      stockTotalDisponible,
      stockTotalVendido,
      regalosUtilizados,
      maximoRegalos,
    };
  }
}
