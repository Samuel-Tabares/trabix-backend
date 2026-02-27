import { Venta, DetalleVenta, TipoVenta } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Interface del repositorio de ventas
 */
export interface IVentaRepository {
  /**
   * Busca una venta por ID
   */
  findById(id: string): Promise<VentaConDetalles | null>;

  /**
   * Lista ventas con filtros y paginación
   */
  findAll(options?: FindVentasOptions): Promise<PaginatedVentas>;

  /**
   * Lista ventas de un vendedor
   */
  findByVendedor(vendedorId: string, options?: FindVentasOptions): Promise<PaginatedVentas>;

  /**
   * Lista ventas de un lote
   */
  findByLote(loteId: string): Promise<VentaConDetalles[]>;

  /**
   * Lista ventas de una tanda
   */
  findByTanda(tandaId: string): Promise<VentaConDetalles[]>;

  /**
   * Crea una nueva venta con detalles
   */
  create(data: CreateVentaData): Promise<VentaConDetalles>;

  /**
   * Cuenta los regalos registrados en un lote
   */
  contarRegalosPorLote(loteId: string): Promise<number>;

  /**
   * Cuenta ventas por criterio
   */
  count(options?: CountVentasOptions): Promise<number>;
}

/**
 * Venta con detalles y datos básicos del vendedor incluidos
 */
export interface VentaConDetalles extends Venta {
  detalles: DetalleVenta[];
  vendedor?: {
    nombre: string;
    telefono: string;
  };
}

/**
 * Opciones para listar ventas
 */
export interface FindVentasOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    vendedorId?: string;
    loteId?: string;
    tandaId?: string;
    searchVendedor?: string;
  };
  orderBy?: {
    field: 'fechaRegistro' | 'montoTotal';
    direction: 'asc' | 'desc';
  };
}

/**
 * Respuesta paginada de ventas
 */
export interface PaginatedVentas {
  data: VentaConDetalles[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Datos para crear una venta
 */
export interface CreateVentaData {
  vendedorId: string;
  loteId: string;
  tandaId: string;
  montoTotal: Decimal;
  cantidadTrabix: number;
  detalles: {
    tipo: TipoVenta;
    cantidad: number;
    precioUnitario: Decimal;
    subtotal: Decimal;
  }[];
}

/**
 * Opciones para contar ventas
 */
export interface CountVentasOptions {
  vendedorId?: string;
  loteId?: string;
}

/**
 * Token de inyección para el repositorio
 */
export const VENTA_REPOSITORY = Symbol('VENTA_REPOSITORY');
