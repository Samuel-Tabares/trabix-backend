import { EstadoLote, ModeloNegocio } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '@domain/exceptions/domain.exception';

/**
 * Entidad de dominio Lote
 * Según secciones 3.1-3.4 del documento
 *
 * Un LOTE es una compra de x cantidad de TRABIX que:
 * - Tiene un costo
 * - Se divide en tandas (2 si ≤50, 3 si >50)
 * - Produce ventas y recaudo
 *
 * Estados: CREADO → ACTIVO → FINALIZADO
 */
export class LoteEntity {
  readonly id: string;
  readonly vendedorId: string;
  readonly version: number;
  readonly cantidadTrabix: number;
  readonly modeloNegocio: ModeloNegocio;
  readonly estado: EstadoLote;
  readonly inversionTotal: Decimal;
  readonly inversionAdmin: Decimal;
  readonly inversionVendedor: Decimal;
  readonly dineroRecaudado: Decimal;
  readonly dineroTransferido: Decimal;
  readonly esLoteForzado: boolean;
  readonly ventaMayorOrigenId: string | null;
  readonly fechaCreacion: Date;
  readonly fechaActivacion: Date | null;
  readonly fechaFinalizacion: Date | null;

  constructor(props: LoteEntityProps) {
    this.id = props.id;
    this.vendedorId = props.vendedorId;
    this.version = props.version;
    this.cantidadTrabix = props.cantidadTrabix;
    this.modeloNegocio = props.modeloNegocio;
    this.estado = props.estado;
    this.inversionTotal = new Decimal(props.inversionTotal);
    this.inversionAdmin = new Decimal(props.inversionAdmin);
    this.inversionVendedor = new Decimal(props.inversionVendedor);
    this.dineroRecaudado = new Decimal(props.dineroRecaudado);
    this.dineroTransferido = new Decimal(props.dineroTransferido);
    this.esLoteForzado = props.esLoteForzado;
    this.ventaMayorOrigenId = props.ventaMayorOrigenId;
    this.fechaCreacion = props.fechaCreacion;
    this.fechaActivacion = props.fechaActivacion;
    this.fechaFinalizacion = props.fechaFinalizacion;
  }
  /**
   * Valida si el lote puede ser activado
   */
  validarActivacion(): void {
    if (this.estado !== 'CREADO') {
      throw new DomainException('LOTE_004', 'Solo se pueden activar lotes en estado CREADO', {
        estadoActual: this.estado,
      });
    }
  }
}

/**
 * Props para crear una entidad Lote
 */
type InversionTotal = Decimal | string | number;
type InversionAdmin = Decimal | string | number;
type InversionVendedor = Decimal | string | number;
type DineroRecaudado = Decimal | string | number;
type DineroTransferido = Decimal | string | number;

export interface LoteEntityProps {
  id: string;
  vendedorId: string;
  version: number;
  cantidadTrabix: number;
  modeloNegocio: ModeloNegocio;
  estado: EstadoLote;
  inversionTotal: InversionTotal;
  inversionAdmin: InversionAdmin;
  inversionVendedor: InversionVendedor;
  dineroRecaudado: DineroRecaudado;
  dineroTransferido: DineroTransferido;
  esLoteForzado: boolean;
  ventaMayorOrigenId: string | null;
  fechaCreacion: Date;
  fechaActivacion: Date | null;
  fechaFinalizacion: Date | null;
}
