import { Decimal } from 'decimal.js';

/**
 * Ganancia de reclutador en el cuadre al mayor
 */
export interface GananciaReclutadorMayor {
  reclutadorId: string;
  nivel: number;
  monto: Decimal;
}

/**
 * Tanda afectada por el cuadre al mayor
 * Incluye información adicional para procesamiento
 */
export interface TandaAfectada {
  tandaId: string;
  cantidadStockConsumido: number;
  numeroTanda: number;
  loteId: string;
}

/**
 * Evaluación financiera del cuadre al mayor
 * Según sección 8.3 del documento
 */
export interface EvaluacionFinanciera {
  dineroRecaudadoDetal: Decimal;
  dineroVentaMayor: Decimal;
  dineroTotalDisponible: Decimal;
  inversionAdminTotal: Decimal;
  inversionVendedorTotal: Decimal;
  inversionAdminCubierta: Decimal;
  inversionVendedorCubierta: Decimal;
  gananciaNeta: Decimal;
  gananciaAdmin: Decimal;
  gananciaVendedor: Decimal;
  deudasSaldadas: Decimal;
  gananciasReclutadores: GananciaReclutadorMayor[];
}

/**
 * Helper para parsear montos Decimal desde valores almacenados
 */
export function parseDecimalValue(value: unknown): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Decimal(value);
  }
  // Handle Prisma.Decimal which is a different class from decimal.js's Decimal
  // (Prisma bundles its own copy, so instanceof check above fails)
  if (value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>).toString === 'function') {
    return new Decimal((value as { toString(): string }).toString());
  }
  return new Decimal(0);
}

/**
 * Helper para formatear Decimal a string con 2 decimales
 */
export function formatDecimal(value: Decimal): string {
  return value.toFixed(2);
}
