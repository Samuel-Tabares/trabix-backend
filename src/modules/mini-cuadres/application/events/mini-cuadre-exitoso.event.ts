import { IEvent } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';

/**
 * Tipo numérico que puede ser Decimal, number o string
 * Usado para compatibilidad con valores almacenados en BD
 */
export type NumericAmount = Decimal | number | string;

/**
 * Helper para convertir NumericAmount a number
 */
export function toNumber(value: NumericAmount): number {
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  if (typeof value === 'string') {
    return Number.parseFloat(value);
  }
  return value;
}

/**
 * Helper para formatear NumericAmount a string con 2 decimales
 */
export function formatAmount(value: NumericAmount): string {
  return toNumber(value).toFixed(2);
}

/**
 * Evento: Mini-Cuadre Exitoso
 *
 * Trigger: Admin confirma mini-cuadre
 *
 * Acciones (sección 23):
 * 1. Marcar última tanda como FINALIZADA
 * 2. Marcar lote como FINALIZADO
 * 3. Enviar notificación al vendedor
 */
export class MiniCuadreExitosoEvent implements IEvent {
  constructor(
    public readonly miniCuadreId: string,
    public readonly loteId: string,
    public readonly tandaId: string,
    public readonly vendedorId: string,
    public readonly montoFinal: NumericAmount,
  ) {}

  /**
   * Obtiene el monto final como número
   */
  getMontoFinalAsNumber(): number {
    return toNumber(this.montoFinal);
  }

  /**
   * Obtiene el monto final formateado con 2 decimales
   */
  getMontoFinalFormatted(): string {
    return formatAmount(this.montoFinal);
  }
}
