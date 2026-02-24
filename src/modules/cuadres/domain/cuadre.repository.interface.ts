import { Cuadre, EstadoCuadre, ConceptoCuadre } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Interface del repositorio de cuadres
 */
export interface ICuadreRepository {
  /**
   * Busca un cuadre por ID
   */
  findById(id: string): Promise<CuadreConTanda | null>;

  /**
   * Busca un cuadre por ID de tanda
   */
  findByTandaId(tandaId: string): Promise<CuadreConTanda | null>;

  /**
   * Lista cuadres con filtros y paginación
   */
  findAll(options?: FindCuadresOptions): Promise<PaginatedCuadres>;

  /**
   * Lista cuadres de un lote
   */
  findByLoteId(loteId: string): Promise<CuadreConTanda[]>;

  /**
   * Lista cuadres de un vendedor
   */
  findByVendedorId(vendedorId: string, options?: FindCuadresOptions): Promise<PaginatedCuadres>;

  /**
   * Crea un nuevo cuadre
   */
  create(data: CreateCuadreData): Promise<Cuadre>;

  /**
   * Activa un cuadre (INACTIVO → PENDIENTE)
   */
  activar(id: string): Promise<Cuadre>;

  /**
   * Confirma un cuadre como exitoso (PENDIENTE → EXITOSO)
   */
  confirmarExitoso(id: string, montoRecibido: Decimal): Promise<Cuadre>;

  /**
   * Cierra un cuadre por cuadre al mayor
   */
  cerrarPorMayor(id: string, cuadreMayorId: string, montoCubierto: Decimal): Promise<Cuadre>;

  /**
   * Actualiza el monto esperado de un cuadre
   */
  actualizarMontoEsperado(id: string, montoEsperado: Decimal, desglose?: DesgloseCuadre): Promise<Cuadre>;

  /**
   * Busca cuadres inactivos que cumplan el trigger
   */
  findCuadresParaActivar(loteId: string): Promise<CuadreConTanda[]>;

  /**
   * Cuenta cuadres por criterio
   */
  count(options?: CountCuadresOptions): Promise<number>;
}

/**
 * Cuadre con tanda incluida
 */
export interface CuadreConTanda extends Cuadre {
  tanda: {
    id: string;
    loteId: string;
    numero: number;
    stockInicial: number;
    stockActual: number;
    estado: string;
    lote?: {
      id: string;
      vendedorId: string;
      cantidadTrabix: number;
      modeloNegocio: string;
      inversionAdmin: any;
      inversionVendedor: any;
      inversionTotal: any;
      dineroRecaudado: any;
      dineroTransferido: any;
    };
  };
}

/**
 * Opciones para listar cuadres
 */
export interface FindCuadresOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    loteId?: string;
    vendedorId?: string;
    estado?: EstadoCuadre;
    concepto?: ConceptoCuadre;
  };
  orderBy?: {
    field: 'fechaPendiente' | 'fechaExitoso' | 'montoEsperado';
    direction: 'asc' | 'desc';
  };
}

/**
 * Respuesta paginada de cuadres
 */
export interface PaginatedCuadres {
  data: CuadreConTanda[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Desglose del monto esperado de un cuadre
 */
export interface DesgloseCuadre {
  inversionAdmin: number;
  gananciasAdmin: number;
  mensualidades: number;
  deudaDano: number;
  deudaPerdida: number;
}

/**
 * Datos para crear un cuadre
 */
export interface CreateCuadreData {
  tandaId: string;
  concepto: ConceptoCuadre;
  montoEsperado: Decimal;
  desglose?: DesgloseCuadre;
}

/**
 * Opciones para contar cuadres
 */
export interface CountCuadresOptions {
  loteId?: string;
  vendedorId?: string;
  estado?: EstadoCuadre;
}

/**
 * Token de inyección para el repositorio
 */
export const CUADRE_REPOSITORY = Symbol('CUADRE_REPOSITORY');
