import {
  CuadreMayorResponseDto,
  EvaluacionFinancieraResponseDto,
  TandaAfectadaResponseDto,
  GananciaReclutadorResponseDto,
} from './index';
import { CuadreMayorConRelaciones } from '../../domain/cuadre-mayor.repository.interface';

/**
 * Mapper para convertir entidades de CuadreMayor a DTOs
 * Centraliza la lógica de mapeo para evitar duplicación en handlers
 */
export class CuadreMayorMapper {
  /**
   * Convierte una entidad CuadreMayor a su DTO de respuesta
   */
  static toResponseDto(cuadre: CuadreMayorConRelaciones): CuadreMayorResponseDto {
    const evaluacion = cuadre.evaluacionFinanciera as Record<string, unknown> | null;

    return {
      id: cuadre.id,
      ventaMayorId: cuadre.ventaMayorId,
      vendedorId: cuadre.vendedorId,
      modalidad: cuadre.modalidad,
      estado: cuadre.estado,
      cantidadUnidades: cuadre.cantidadUnidades,
      precioUnidad: this.parseDecimal(cuadre.precioUnidad),
      ingresoBruto: this.parseDecimal(cuadre.ingresoBruto),
      deudasSaldadas: this.parseDecimal(cuadre.deudasSaldadas),
      inversionAdminLotesExistentes: this.parseDecimal(cuadre.inversionAdminLotesExistentes),
      inversionAdminLoteForzado: this.parseDecimal(cuadre.inversionAdminLoteForzado),
      inversionVendedorLotesExistentes: this.parseDecimal(cuadre.inversionVendedorLotesExistentes),
      inversionVendedorLoteForzado: this.parseDecimal(cuadre.inversionVendedorLoteForzado),
      gananciasAdmin: this.parseDecimal(cuadre.gananciasAdmin),
      gananciasVendedor: this.parseDecimal(cuadre.gananciasVendedor),
      evaluacionFinanciera: this.mapEvaluacionFinanciera(evaluacion),
      montoTotalAdmin: this.parseDecimal(cuadre.montoTotalAdmin),
      montoTotalVendedor: this.parseDecimal(cuadre.montoTotalVendedor),
      lotesInvolucradosIds: cuadre.lotesInvolucradosIds ?? [],
      tandasAfectadas: this.mapTandasAfectadas(cuadre.tandasAfectadas),
      cuadresCerradosIds: cuadre.cuadresCerradosIds ?? [],
      loteForzadoId: cuadre.loteForzadoId,
      gananciasReclutadores: this.mapGananciasReclutadores(cuadre.gananciasReclutadores),
      fechaRegistro: cuadre.fechaRegistro,
      fechaExitoso: cuadre.fechaExitoso,
    };
  }

  /**
   * Mapea la evaluación financiera al DTO
   */
  private static mapEvaluacionFinanciera(
    evaluacion: Record<string, unknown> | null | undefined,
  ): EvaluacionFinancieraResponseDto {
    return {
      dineroRecaudadoDetal: this.parseDecimal(evaluacion?.dineroRecaudadoDetal ?? '0'),
      dineroVentaMayor: this.parseDecimal(evaluacion?.dineroVentaMayor ?? '0'),
      dineroTotalDisponible: this.parseDecimal(evaluacion?.dineroTotalDisponible ?? '0'),
      inversionAdminTotal: this.parseDecimal(evaluacion?.inversionAdminTotal ?? '0'),
      inversionVendedorTotal: this.parseDecimal(evaluacion?.inversionVendedorTotal ?? '0'),
      gananciaNeta: this.parseDecimal(evaluacion?.gananciaNeta ?? '0'),
      gananciaAdmin: this.parseDecimal(evaluacion?.gananciaAdmin ?? '0'),
      gananciaVendedor: this.parseDecimal(evaluacion?.gananciaVendedor ?? '0'),
      deudasSaldadas: this.parseDecimal(evaluacion?.deudasSaldadas ?? '0'),
    };
  }

  /**
   * Mapea las tandas afectadas al DTO
   */
  private static mapTandasAfectadas(tandasAfectadas: unknown): TandaAfectadaResponseDto[] {
    if (!Array.isArray(tandasAfectadas)) {
      return [];
    }

    return tandasAfectadas.map((t: Record<string, unknown>) => ({
      tandaId: String(t.tandaId ?? ''),
      cantidadStockConsumido: Number(t.cantidadStockConsumido ?? 0),
    }));
  }

  /**
   * Mapea las ganancias de reclutadores al DTO
   */
  private static mapGananciasReclutadores(
    ganancias:
      | Array<{
          id: string;
          reclutadorId: string;
          nivel: number;
          monto: unknown;
          transferido: boolean;
        }>
      | undefined,
  ): GananciaReclutadorResponseDto[] {
    if (!Array.isArray(ganancias)) {
      return [];
    }

    return ganancias.map((g) => ({
      reclutadorId: g.reclutadorId,
      nivel: g.nivel,
      monto: this.parseDecimal(g.monto),
      transferido: g.transferido,
    }));
  }

  /**
   * Parsea un valor a número con seguridad
   */
  private static parseDecimal(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    // Si es Decimal de decimal.js
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return 0;
  }
}
