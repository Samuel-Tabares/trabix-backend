import { Lote, Tanda, EstadoLote, ModeloNegocio } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Interface del repositorio de lotes
 */
export interface ILoteRepository {
  /**
   * Busca un lote por ID
   */
  findById(id: string): Promise<LoteConTandas | null>;

  /**
   * Busca lotes de un vendedor
   */
  findByVendedor(vendedorId: string, options?: FindLotesOptions): Promise<PaginatedLotes>;

  /**
   * Lista todos los lotes con filtros
   */
  findAll(options?: FindLotesOptions): Promise<PaginatedLotes>;

  /**
   * Obtiene el lote activo más antiguo de un vendedor (para consumo de ventas)
   */
  findLoteActivoMasAntiguo(vendedorId: string): Promise<LoteConTandas | null>;

  /**
   * Obtiene todos los lotes ACTIVO de un vendedor ordenados por fechaActivacion ASC
   * (para lógica cross-lote)
   */
  findLotesActivos(vendedorId: string): Promise<LoteConTandas[]>;

  /**
   * Crea un nuevo lote con sus tandas
   */
  create(data: CreateLoteData): Promise<LoteConTandas>;

  /**
   * Activa un lote (CREADO → ACTIVO)
   */
  activar(id: string): Promise<LoteConTandas>;

  /**
   * Cancela un lote en estado CREADO (elimina el lote y sus tandas)
   */
  cancelar(id: string): Promise<void>;

  /**
   * Finaliza un lote (ACTIVO → FINALIZADO)
   */
  finalizar(id: string): Promise<LoteConTandas>;

  /**
   * Actualiza el dinero recaudado
   */
  actualizarRecaudado(id: string, monto: Decimal): Promise<Lote>;

  /**
   * Actualiza el dinero transferido
   */
  actualizarTransferido(id: string, monto: Decimal): Promise<Lote>;

  /**
   * Cuenta lotes por criterio
   */
  count(options?: CountLotesOptions): Promise<number>;

  /**
   * Cuenta los regalos APROBADOS de un lote
   * Se usa para validar el límite de regalos y mostrar en resumen financiero
   */
  contarRegalosAprobados(loteId: string): Promise<number>;
}

/**
 * Lote con sus tandas incluidas
 */
export interface LoteConTandas extends Lote {
  tandas: Tanda[];
}

/**
 * Opciones para listar lotes
 */
export interface FindLotesOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    vendedorId?: string;
    estado?: EstadoLote;
    modeloNegocio?: ModeloNegocio;
    esLoteForzado?: boolean;
  };
  orderBy?: {
    field: 'fechaCreacion' | 'fechaActivacion' | 'cantidadTrabix';
    direction: 'asc' | 'desc';
  };
}

/**
 * Respuesta paginada de lotes
 */
export interface PaginatedLotes {
  data: LoteConTandas[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Datos para crear un lote
 */
export interface CreateLoteData {
  vendedorId: string;
  cantidadTrabix: number;
  modeloNegocio: ModeloNegocio;
  inversionTotal: Decimal;
  inversionAdmin: Decimal;
  inversionVendedor: Decimal;
  esLoteForzado?: boolean;
  ventaMayorOrigenId?: string | null;
  tandas: {
    numero: number;
    stockInicial: number;
  }[];
}

/**
 * Opciones para contar lotes
 */
export interface CountLotesOptions {
  vendedorId?: string;
  estado?: EstadoLote;
}

/**
 * Token de inyección para el repositorio
 */
export const LOTE_REPOSITORY = Symbol('LOTE_REPOSITORY');
