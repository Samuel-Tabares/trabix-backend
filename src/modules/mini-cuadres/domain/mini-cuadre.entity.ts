import { EstadoMiniCuadre } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Entidad de dominio MiniCuadre
 * Según sección 9 del documento
 *
 * El mini-cuadre es un evento distinto al cuadre normal que cierra el lote.
 * Se activa cuando el stock de la última tanda llega a 0.
 *
 * Estados:
 * - INACTIVO: stock de última tanda > 0
 * - PENDIENTE: stock de última tanda = 0
 * - EXITOSO: admin confirma consolidación final
 */
export class MiniCuadreEntity {
  readonly id: string;
  readonly loteId: string;
  readonly tandaId: string;
  readonly estado: EstadoMiniCuadre;
  readonly montoFinal: Decimal;
  readonly fechaPendiente: Date | null;
  readonly fechaExitoso: Date | null;

  constructor(props: MiniCuadreEntityProps) {
    this.id = props.id;
    this.loteId = props.loteId;
    this.tandaId = props.tandaId;
    this.estado = props.estado;
    this.montoFinal = new Decimal(props.montoFinal);
    this.fechaPendiente = props.fechaPendiente;
    this.fechaExitoso = props.fechaExitoso;
  }
  /**
   * Valida que se puede confirmar el mini-cuadre
   */
  validarConfirmacion(): void {
    if (this.estado !== 'PENDIENTE') {
      throw new DomainException(
        'MCU_002',
        'Solo se pueden confirmar mini-cuadres en estado PENDIENTE',
        { estadoActual: this.estado },
      );
    }
  }
}

/**
 * Props para crear una entidad MiniCuadre
 */
export interface MiniCuadreEntityProps {
  id: string;
  loteId: string;
  tandaId: string;
  estado: EstadoMiniCuadre;
  montoFinal: Decimal | string | number;
  fechaPendiente: Date | null;
  fechaExitoso: Date | null;
}
