import { Decimal } from 'decimal.js';
import {
  EstadoPedidoStock,
  PedidoStock,
  DetalleCostoPedido,
  ConfiguracionSistema,
  HistorialConfiguracion,
  TipoInsumo,
  StockAdmin,
} from '@prisma/client';

// ========== PedidoStock Repository ==========

export interface CreatePedidoStockData {
  cantidadTrabix: number;
  notas?: string;
}

export interface UpdatePedidoStockData {
  cantidadTrabix?: number;
  notas?: string;
}

export interface CreateDetalleCostoData {
  pedidoId: string;
  concepto: string;
  esObligatorio: boolean;
  cantidad?: number;
  costoTotal: Decimal;
}

export interface PedidoStockWithDetalles extends PedidoStock {
  detallesCosto: DetalleCostoPedido[];
}

export interface IPedidoStockRepository {
  /**
   * Busca un pedido por ID con sus detalles de costo
   */
  findById(id: string): Promise<PedidoStockWithDetalles | null>;

  /**
   * Lista pedidos con filtros y paginación
   */
  findAll(options?: { estado?: EstadoPedidoStock; skip?: number; take?: number }): Promise<{
    data: PedidoStockWithDetalles[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Crea un nuevo pedido en estado BORRADOR
   */
  create(data: CreatePedidoStockData): Promise<PedidoStock>;

  /**
   * Actualiza un pedido en estado BORRADOR
   */
  update(id: string, data: UpdatePedidoStockData): Promise<PedidoStock>;

  /**
   * Agrega un detalle de costo al pedido
   */
  agregarCosto(data: CreateDetalleCostoData): Promise<DetalleCostoPedido>;

  /**
   * Elimina un detalle de costo
   */
  eliminarCosto(costoId: string): Promise<void>;

  /**
   * Marca el pedido como recibido (BORRADOR → RECIBIDO), calcula y persiste costos
   */
  recibir(id: string, costoTotal: Decimal, costoRealPorTrabix: Decimal): Promise<PedidoStock>;
}

export const PEDIDO_STOCK_REPOSITORY = Symbol('PEDIDO_STOCK_REPOSITORY');

// ========== ConfiguracionSistema Repository ==========

export interface HistorialOptions {
  clave?: string;
  skip?: number;
  take?: number;
}

export interface RegistrarHistorialData {
  clave: string;
  valorAnterior: string;
  valorNuevo: string;
  modificadoPorId: string;
  motivo?: string;
}

export interface IConfiguracionRepository {
  /**
   * Busca una configuración por clave
   */
  findByClave(clave: string): Promise<ConfiguracionSistema | null>;

  /**
   * Busca configuraciones por categoría
   */
  findByCategoria(categoria: string): Promise<ConfiguracionSistema[]>;

  /**
   * Lista todas las configuraciones
   */
  findAll(): Promise<ConfiguracionSistema[]>;

  /**
   * Actualiza el valor de una configuración
   */
  actualizar(clave: string, valor: string, modificadoPorId: string): Promise<ConfiguracionSistema>;

  /**
   * Obtiene el historial de cambios
   */
  getHistorial(options?: HistorialOptions): Promise<{
    data: HistorialConfiguracion[];
    total: number;
  }>;

  /**
   * Registra un cambio en el historial
   */
  registrarHistorial(data: RegistrarHistorialData): Promise<HistorialConfiguracion>;
}

export const CONFIGURACION_REPOSITORY = Symbol('CONFIGURACION_REPOSITORY');

// ========== TipoInsumo Repository ==========

export interface CreateTipoInsumoData {
  nombre: string;
  esObligatorio?: boolean;
}

export interface ITipoInsumoRepository {
  /**
   * Busca un tipo de insumo por ID
   */
  findById(id: string): Promise<TipoInsumo | null>;

  /**
   * Busca un tipo de insumo por nombre
   */
  findByNombre(nombre: string): Promise<TipoInsumo | null>;

  /**
   * Lista todos los tipos de insumo
   */
  findAll(): Promise<TipoInsumo[]>;

  /**
   * Lista los tipos de insumo obligatorios activos
   */
  findObligatorios(): Promise<TipoInsumo[]>;

  /**
   * Crea un nuevo tipo de insumo
   */
  create(data: CreateTipoInsumoData): Promise<TipoInsumo>;

  /**
   * Actualiza un tipo de insumo
   */
  update(id: string, data: Partial<CreateTipoInsumoData>): Promise<TipoInsumo>;

  /**
   * Elimina permanentemente un tipo de insumo
   */
  delete(id: string): Promise<void>;
}

export const TIPO_INSUMO_REPOSITORY = Symbol('TIPO_INSUMO_REPOSITORY');

// ========== StockAdmin Repository ==========

export interface IStockAdminRepository {
  /**
   * Obtiene el registro de stock admin
   */
  get(): Promise<StockAdmin | null>;

  /**
   * Incrementa el stock físico
   */
  incrementarStock(cantidad: number, pedidoId: string): Promise<StockAdmin>;

  /**
   * Decrementa el stock físico
   */
  decrementarStock(cantidad: number): Promise<StockAdmin>;

  /**
   * Calcula el stock reservado (comprometido pero no entregado)
   */
  getStockReservado(): Promise<number>;

  /**
   * Calcula el déficit (stock comprometido que excede el físico)
   */
  getDeficit(): Promise<number>;
}

export const STOCK_ADMIN_REPOSITORY = Symbol('STOCK_ADMIN_REPOSITORY');
