import { CuadreMayor, EstadoCuadre, ModalidadVentaMayor } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  EvaluacionFinanciera,
  TandaAfectada,
  GananciaReclutadorMayor,
} from './cuadre-mayor.entity';

/**
 * Cuadre al mayor con relaciones
 */
export interface CuadreMayorConRelaciones extends CuadreMayor {
  ventaMayor?: {
    id: string;
    cantidadUnidades: number;
    conLicor: boolean;
    estado: string;
  };
  gananciasReclutadores?: {
    id: string;
    reclutadorId: string;
    nivel: number;
    monto: any;
    transferido: boolean;
  }[];
}

/**
 * Opciones para listar cuadres al mayor
 */
export interface FindCuadresMayorOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    vendedorId?: string;
    estado?: EstadoCuadre;
    modalidad?: ModalidadVentaMayor;
    searchVendedor?: string;
  };
}

/**
 * Respuesta paginada de cuadres al mayor
 */
export interface PaginatedCuadresMayor {
  data: CuadreMayorConRelaciones[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Datos para crear un cuadre al mayor
 */
export interface CreateCuadreMayorData {
  ventaMayorId: string;
  vendedorId: string;
  modalidad: ModalidadVentaMayor;
  cantidadUnidades: number;
  precioUnidad: Decimal;
  ingresoBruto: Decimal;
  deudasSaldadas: Decimal;
  inversionAdminLotesExistentes: Decimal;
  inversionAdminLoteForzado: Decimal;
  inversionVendedorLotesExistentes: Decimal;
  inversionVendedorLoteForzado: Decimal;
  gananciasAdmin: Decimal;
  gananciasVendedor: Decimal;
  evaluacionFinanciera: EvaluacionFinanciera;
  montoTotalAdmin: Decimal;
  montoTotalVendedor: Decimal;
  lotesInvolucradosIds: string[];
  tandasAfectadas: TandaAfectada[];
  loteForzadoId?: string;
  gananciasReclutadores: GananciaReclutadorMayor[];
}

// ========== NUEVAS INTERFACES PARA TRANSACCIÓN ATÓMICA ==========

/**
 * Distribución de montos por lote (para prorrateo)
 */
export interface DistribucionMontoLote {
  loteId: string;
  stockConsumido: number;
  montoRecaudado: Decimal;
  montoTransferido: Decimal;
  montoVendedor: Decimal;
}

/**
 * Tanda a procesar en la transacción
 */
export interface TandaParaProcesar {
  tandaId: string;
  loteId: string;
  numeroTanda: number;
  cantidadStockConsumido: number;
  stockRestanteDespuesConsumo: number;
  esUltimaTanda: boolean;
  estadoActual: string;
}

/**
 * Cuadre a cerrar en la transacción (por agotamiento de stock)
 */
export interface CuadreParaCerrar {
  cuadreId: string;
  loteId: string;
  tandaId: string;
  montoEsperado: string;
}

/**
 * Cuadre PENDIENTE a actualizar vía deudasSaldadas del cuadre mayor
 * Distinto de CuadreParaCerrar: usa valor absoluto (no reemplaza stock-exhaustion logic)
 */
export interface CuadreDeudaSaldada {
  cuadreId: string;
  nuevaMontoCubiertoPorMayor: string; // absolute new value
  esFullClosure: boolean; // if true, also mark EXITOSO
}

/**
 * Pago a aplicar a deuda de equipamiento en la transacción
 */
export interface EquipamentoPago {
  equipamientoId: string;
  deudaDanoReducir: string;
  deudaPerdidaReducir: string;
  nuevaUltimaMensualidadPagada: Date | null;
}

/**
 * Datos para la transacción de confirmación de cuadre al mayor
 */
export interface ConfirmarCuadreMayorTransactionData {
  cuadreMayorId: string;
  montoTotalAdmin: Decimal;
  ingresoBruto: Decimal;

  // Tandas a procesar
  tandasParaProcesar: TandaParaProcesar[];

  // Cuadres a cerrar por agotamiento de stock
  cuadresParaCerrar: CuadreParaCerrar[];

  // Cuadres PENDIENTE a acreditar vía deudasSaldadas (sin agotamiento de stock)
  cuadresDeudaSaldada: CuadreDeudaSaldada[];

  // Pago a aplicar a deuda de equipamiento (puede ser null)
  equipamentoPago: EquipamentoPago | null;

  // Distribución prorrateada por lote
  distribucionPorLote: DistribucionMontoLote[];

  // Lote forzado (opcional)
  loteForzado: {
    id: string;
    tandasIds: string[];
  } | null;
}

/**
 * Resultado de la transacción de confirmación
 */
export interface ConfirmarCuadreMayorTransactionResult {
  cuadreMayor: CuadreMayor;
  cuadresCerradosIds: string[];
  tandasFinalizadasIds: string[];
  tandasConStockAgotadoUltimas: Array<{ tandaId: string; loteId: string }>;
}

// ========== FIN NUEVAS INTERFACES ==========

/**
 * Interface del repositorio de cuadres al mayor
 */
export interface ICuadreMayorRepository {
  /**
   * Busca un cuadre al mayor por ID
   */
  findById(id: string): Promise<CuadreMayorConRelaciones | null>;

  /**
   * Busca un cuadre al mayor por ID de venta
   */
  findByVentaMayorId(ventaMayorId: string): Promise<CuadreMayorConRelaciones | null>;

  /**
   * Lista cuadres al mayor con filtros y paginación
   */
  findAll(options?: FindCuadresMayorOptions): Promise<PaginatedCuadresMayor>;

  /**
   * Lista cuadres al mayor de un vendedor
   */
  findByVendedorId(
    vendedorId: string,
    options?: FindCuadresMayorOptions,
  ): Promise<PaginatedCuadresMayor>;

  /**
   * Crea un nuevo cuadre al mayor
   */
  create(data: CreateCuadreMayorData): Promise<CuadreMayor>;

  /**
   * Confirma un cuadre al mayor como exitoso
   * @deprecated Usar confirmarExitosoTransaccional para operaciones atómicas
   */
  confirmarExitoso(id: string, cuadresCerradosIds: string[]): Promise<CuadreMayor>;

  /**
   * Confirma un cuadre al mayor con todas las operaciones en una transacción atómica
   * Incluye: consumo de stock, cierre de cuadres, actualización de lotes, etc.
   */
  confirmarExitosoTransaccional(
    data: ConfirmarCuadreMayorTransactionData,
  ): Promise<ConfirmarCuadreMayorTransactionResult>;

  /**
   * Cuenta cuadres al mayor por criterio
   */
  count(options?: { vendedorId?: string; estado?: EstadoCuadre }): Promise<number>;
}

/**
 * Token de inyección para el repositorio
 */
export const CUADRE_MAYOR_REPOSITORY = Symbol('CUADRE_MAYOR_REPOSITORY');
