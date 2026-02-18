import { IEvent } from '@nestjs/cqrs';
import { ModalidadVentaMayor } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Evento: Venta al Mayor Registrada
 *
 * Se dispara cuando se registra una venta al mayor.
 * Genera automáticamente el cuadre al mayor.
 */
export class VentaMayorRegistradaEvent implements IEvent {
  constructor(
    public readonly ventaMayorId: string,
    public readonly vendedorId: string,
    public readonly cantidadUnidades: number,
    public readonly ingresoBruto: Decimal,
    public readonly modalidad: ModalidadVentaMayor,
    public readonly necesitaLoteForzado: boolean,
    public readonly cantidadLoteForzado: number,
    public readonly lotesInvolucradosIds: string[],
  ) {}
}
