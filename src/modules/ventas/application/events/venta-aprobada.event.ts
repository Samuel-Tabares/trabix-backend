import { IEvent } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';

/**
 * Evento: Venta Aprobada
 * Según sección 23 del documento
 *
 * Trigger: Admin aprueba venta
 *
 * Acciones:
 * 1. Actualizar stock de tanda (ya reducido, confirmar)
 * 2. Actualizar dinero recaudado del lote
 * 3. Verificar trigger de cuadre (dinero o %)
 * 4. Si stock <= 25%: Enviar notificación
 * 5. Si inversión recuperada: Enviar notificación
 */
export class VentaAprobadaEvent implements IEvent {
  constructor(
    public readonly ventaId: string,
    public readonly vendedorId: string,
    public readonly loteId: string,
    public readonly tandaId: string,
    public readonly montoTotal: Decimal,
    public readonly cantidadTrabix: number,
  ) {}
}
