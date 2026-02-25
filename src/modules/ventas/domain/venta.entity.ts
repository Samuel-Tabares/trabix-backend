import { TipoVenta } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * NOTA: Los PRECIOS se obtienen de CalculadoraPreciosVentaService
 * para mantener la entidad pura (sin dependencias de infraestructura)
 */

/**
 * Entidad de dominio Venta
 * Las ventas se confirman automáticamente al registrarse.
 */
export class VentaEntity {
  readonly id: string;
  readonly vendedorId: string;
  readonly loteId: string;
  readonly tandaId: string;
  readonly montoTotal: Decimal;
  readonly cantidadTrabix: number;
  readonly fechaRegistro: Date;
  readonly detalles: DetalleVentaEntity[];

  constructor(props: VentaEntityProps) {
    this.id = props.id;
    this.vendedorId = props.vendedorId;
    this.loteId = props.loteId;
    this.tandaId = props.tandaId;
    this.montoTotal = new Decimal(props.montoTotal);
    this.cantidadTrabix = props.cantidadTrabix;
    this.fechaRegistro = props.fechaRegistro;
    this.detalles = props.detalles || [];
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
  montoTotal: MontoTotal;
  cantidadTrabix: number;
  fechaRegistro: Date;
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
