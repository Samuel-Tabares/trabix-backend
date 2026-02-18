import { EstadoVenta, TipoVenta } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * NOTA: Los PRECIOS se obtienen de CalculadoraPreciosVentaService
 * para mantener la entidad pura (sin dependencias de infraestructura)
 */

/**
 * Entidad de dominio Venta
 * Según sección 6 del documento
 *
 * Flujo de venta al detal:
 * 1. Vendedor registra venta colectiva
 * 2. Venta queda en estado PENDIENTE
 * 3. Stock se reduce temporalmente
 * 4. Admin revisa:
 *    - Si APRUEBA: stock se reduce definitivamente, venta genera recaudo
 *    - Si RECHAZA: stock se revierte, venta se elimina sin efectos contables
 */
export class VentaEntity {
  readonly id: string;
  readonly vendedorId: string;
  readonly loteId: string;
  readonly tandaId: string;
  readonly estado: EstadoVenta;
  readonly montoTotal: Decimal;
  readonly cantidadTrabix: number;
  readonly fechaRegistro: Date;
  readonly fechaValidacion: Date | null;
  readonly detalles: DetalleVentaEntity[];

  constructor(props: VentaEntityProps) {
    this.id = props.id;
    this.vendedorId = props.vendedorId;
    this.loteId = props.loteId;
    this.tandaId = props.tandaId;
    this.estado = props.estado;
    this.montoTotal = new Decimal(props.montoTotal);
    this.cantidadTrabix = props.cantidadTrabix;
    this.fechaRegistro = props.fechaRegistro;
    this.fechaValidacion = props.fechaValidacion;
    this.detalles = props.detalles || [];
  }
  /**
   * Valida si la venta puede ser aprobada
   */
  validarAprobacion(): void {
    if (this.estado !== 'PENDIENTE') {
      throw new DomainException('VNT_003', 'Solo se pueden aprobar ventas en estado PENDIENTE', {
        estadoActual: this.estado,
      });
    }
  }

  /**
   * Valida si la venta puede ser rechazada
   */
  validarRechazo(): void {
    if (this.estado !== 'PENDIENTE') {
      throw new DomainException('VNT_004', 'Solo se pueden rechazar ventas en estado PENDIENTE', {
        estadoActual: this.estado,
      });
    }
  }
}

/**
 * Entidad de detalle de venta
 */
export class DetalleVentaEntity {
  readonly id: string;
  readonly ventaId: string;
  readonly tipo: TipoVenta;
  readonly cantidad: number;
  readonly precioUnitario: Decimal;
  readonly subtotal: Decimal;

  constructor(props: DetalleVentaEntityProps) {
    this.id = props.id;
    this.ventaId = props.ventaId;
    this.tipo = props.tipo;
    this.cantidad = props.cantidad;
    this.precioUnitario = new Decimal(props.precioUnitario);
    this.subtotal = new Decimal(props.subtotal);
  }
}

/**
 * Props para crear una entidad Venta
 */
type MontoTotal = Decimal | string | number;

export interface VentaEntityProps {
  id: string;
  vendedorId: string;
  loteId: string;
  tandaId: string;
  estado: EstadoVenta;
  montoTotal: MontoTotal;
  cantidadTrabix: number;
  fechaRegistro: Date;
  fechaValidacion: Date | null;
  detalles?: DetalleVentaEntity[];
}

/**
 * Props para crear un detalle de venta
 */
export interface DetalleVentaEntityProps {
  id: string;
  ventaId: string;
  tipo: TipoVenta;
  cantidad: number;
  precioUnitario: Decimal | string | number;
  subtotal: Decimal | string | number;
}
