import { EstadoTanda } from '@prisma/client';
import { DomainException } from '@domain/exceptions/domain.exception';

/**
 * Entidad de dominio Tanda
 * Según secciones 4.1-4.4 del documento
 *
 * Una TANDA es simultáneamente:
 * - Unidad de liberación de stock
 * - Unidad de bloqueo / desbloqueo
 * - Unidad de riesgo financiero
 * - Unidad de control de progresión del lote
 *
 * Estados: INACTIVA → EN_TRANSITO → EN_CASA → FINALIZADA
 * Las tandas nunca retroceden de estado.
 */
export class TandaEntity {
  readonly id: string;
  readonly loteId: string;
  readonly version: number;
  readonly numero: number;
  readonly estado: EstadoTanda;
  readonly stockInicial: number;
  readonly stockActual: number;
  readonly stockConsumidoPorMayor: number;
  readonly liberadaPorCuadreMayorId: string | null;
  readonly fechaLiberacion: Date | null;
  readonly fechaEnTransito: Date | null;
  readonly fechaEnCasa: Date | null;
  readonly fechaFinalizada: Date | null;

  constructor(props: TandaEntityProps) {
    this.id = props.id;
    this.loteId = props.loteId;
    this.version = props.version;
    this.numero = props.numero;
    this.estado = props.estado;
    this.stockInicial = props.stockInicial;
    this.stockActual = props.stockActual;
    this.stockConsumidoPorMayor = props.stockConsumidoPorMayor;
    this.liberadaPorCuadreMayorId = props.liberadaPorCuadreMayorId;
    this.fechaLiberacion = props.fechaLiberacion;
    this.fechaEnTransito = props.fechaEnTransito;
    this.fechaEnCasa = props.fechaEnCasa;
    this.fechaFinalizada = props.fechaFinalizada;
  }
  /**
   * Valida si se puede confirmar entrega (EN_TRÁNSITO → EN_CASA)
   */
  validarConfirmacionEntrega(): void {
    if (this.estado !== 'EN_TRANSITO') {
      throw new DomainException(
        'TND_002',
        'Solo se puede confirmar entrega de tandas EN_TRÁNSITO',
        { estadoActual: this.estado },
      );
    }
  }
}

/**
 * Props para crear una entidad Tanda
 */
export interface TandaEntityProps {
  id: string;
  loteId: string;
  version: number;
  numero: number;
  estado: EstadoTanda;
  stockInicial: number;
  stockActual: number;
  stockConsumidoPorMayor: number;
  liberadaPorCuadreMayorId: string | null;
  fechaLiberacion: Date | null;
  fechaEnTransito: Date | null;
  fechaEnCasa: Date | null;
  fechaFinalizada: Date | null;
}
