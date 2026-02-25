import { IEvent } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';

/**
 * Evento: Venta Registrada
 * Se publica cuando el vendedor o reclutador registra una venta.
 * Las ventas se confirman automáticamente al registrarse.
 *
 * Acciones:
 * 1. Actualizar dinero recaudado del lote
 * 2. Actualizar montoEsperado del cuadre
 * 3. Verificar trigger de cuadre (dinero o %)
 * 4. Si stock <= 25%: Enviar notificación
 * 5. Si inversión recuperada: Enviar notificación
 * 6. Si última tanda llega a 0: Activar mini-cuadre
 */
export class VentaRegistradaEvent implements IEvent {
  constructor(
    public readonly ventaId: string,
    public readonly vendedorId: string,
    public readonly loteId: string,
    public readonly tandaId: string,
    public readonly montoTotal: Decimal,
    public readonly cantidadTrabix: number,
  ) {}
}
