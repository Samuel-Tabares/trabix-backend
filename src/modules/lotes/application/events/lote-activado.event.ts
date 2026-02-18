import { IEvent } from '@nestjs/cqrs';
import { ModeloNegocio } from '@prisma/client';

/**
 * Evento: Lote Activado
 * Según sección 23 del documento
 *
 * Trigger: Admin confirma pago de inversión
 *
 * Acciones:
 * 1. Liberar Tanda 1 (ya se hace en el repositorio)
 * 2. Crear cuadres para cada tanda
 * 3. Crear mini-cuadre
 * 4. Registrar entrada en fondo de recompensas
 * 5. Enviar notificación al vendedor
 */
export class LoteActivadoEvent implements IEvent {
  constructor(
    public readonly loteId: string,
    public readonly vendedorId: string,
    public readonly cantidadTrabix: number,
    public readonly modeloNegocio: ModeloNegocio,
    public readonly tandas: TandaInfo[],
  ) {}
}

export interface TandaInfo {
  id: string;
  numero: number;
  stockInicial: number;
}
