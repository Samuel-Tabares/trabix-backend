import { IEvent } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';

/**
 * Evento: Cuadre Exitoso
 * Según sección 23 del documento
 *
 * Trigger: Admin confirma cuadre
 *
 * Acciones:
 * 1. Actualizar dinero transferido del lote
 * 2. Liberar siguiente tanda
 * 3. Enviar notificación al vendedor
 */
export class CuadreExitosoEvent implements IEvent {
  constructor(
    public readonly cuadreId: string,
    public readonly tandaId: string,
    public readonly loteId: string,
    public readonly vendedorId: string,
    public readonly montoRecibido: Decimal,
    public readonly numeroTanda: number,
  ) {}
}
