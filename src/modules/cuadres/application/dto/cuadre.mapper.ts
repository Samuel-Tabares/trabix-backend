import { CuadreResponseDto, TandaCuadreResponseDto, DesgloseCuadreDto } from './cuadre-response.dto';
import { CuadreConTanda } from '../../domain/cuadre.repository.interface';

/**
 * Mapper para convertir entidades de Cuadre a DTOs
 * Centraliza la lógica de mapeo para evitar duplicación en handlers
 */
export class CuadreMapper {
  /**
   * Convierte una entidad Cuadre a su DTO de respuesta
   */
  static toResponseDto(cuadre: CuadreConTanda): CuadreResponseDto {
    const montoEsperado = this.parseDecimal(cuadre.montoEsperado);
    const montoCubiertoPorMayor = this.parseDecimal(cuadre.montoCubiertoPorMayor);
    const montoEsperadoAjustado = montoEsperado - montoCubiertoPorMayor;

    const tanda = this.mapTanda(cuadre.tanda);

    // Obtener vendedorId desde la relación tanda → lote
    const vendedorId = cuadre.tanda.lote?.vendedorId ?? '';

    return {
      id: cuadre.id,
      tandaId: cuadre.tandaId,
      vendedorId,
      estado: cuadre.estado,
      concepto: cuadre.concepto,
      montoEsperado,
      montoRecibido: this.parseDecimal(cuadre.montoRecibido),
      montoFaltante: this.parseDecimal(cuadre.montoFaltante),
      montoCubiertoPorMayor,
      montoEsperadoAjustado,
      cerradoPorCuadreMayorId: cuadre.cerradoPorCuadreMayorId,
      fechaPendiente: cuadre.fechaPendiente,
      fechaExitoso: cuadre.fechaExitoso,
      tanda,
      fueCerradoPorMayor: cuadre.cerradoPorCuadreMayorId !== null,
      desglose: cuadre.desglose ? (cuadre.desglose as unknown as DesgloseCuadreDto) : null,
    };
  }

  /**
   * Mapea la información de la tanda al DTO
   */
  private static mapTanda(tanda: CuadreConTanda['tanda']): TandaCuadreResponseDto {
    return {
      id: tanda.id,
      loteId: tanda.loteId,
      numero: tanda.numero,
      stockInicial: tanda.stockInicial,
      stockActual: tanda.stockActual,
      estado: tanda.estado,
    };
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
