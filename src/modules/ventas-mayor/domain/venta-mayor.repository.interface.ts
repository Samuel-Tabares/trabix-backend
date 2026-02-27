import { VentaMayor, ModalidadVentaMayor, EstadoVentaMayor } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { FuenteStock } from './venta-mayor.entity';

/**
 * Venta al mayor con relaciones
 */
export interface VentaMayorConRelaciones extends VentaMayor {
  vendedor?: {
    id: string;
    nombres: string;
    apellidos: string;
    email: string;
  };
  fuentesStock?: {
    id: string;
    tandaId: string;
    cantidadConsumida: number;
    tipoStock: string;
  }[];
  lotesInvolucrados?: {
    id: string;
    loteId: string;
  }[];
  cuadreMayor?: {
    id: string;
    estado: string;
  };
}

/**
 * Opciones para listar ventas al mayor
 */
export interface FindVentasMayorOptions {
  skip?: number;
  take?: number;
  cursor?: string;
  where?: {
    vendedorId?: string;
    estado?: EstadoVentaMayor;
    modalidad?: ModalidadVentaMayor;
    searchVendedor?: string;
  };
}

/**
 * Respuesta paginada de ventas al mayor
 */
export interface PaginatedVentasMayor {
  data: VentaMayorConRelaciones[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Datos para crear una venta al mayor
 */
export interface CreateVentaMayorData {
  vendedorId: string;
  cantidadUnidades: number;
  precioUnidad: Decimal;
  ingresoBruto: Decimal;
  conLicor: boolean;
  modalidad: ModalidadVentaMayor;
  fuentesStock: FuenteStock[];
  lotesInvolucradosIds: string[];
  loteForzadoId?: string;
}

/**
 * Interface del repositorio de ventas al mayor
 */
export interface IVentaMayorRepository {
  /**
   * Busca una venta al mayor por ID
   */
  findById(id: string): Promise<VentaMayorConRelaciones | null>;

  /**
   * Lista ventas al mayor con filtros y paginación
   */
  findAll(options?: FindVentasMayorOptions): Promise<PaginatedVentasMayor>;

  /**
   * Lista ventas al mayor de un vendedor
   */
  findByVendedorId(
    vendedorId: string,
    options?: FindVentasMayorOptions,
  ): Promise<PaginatedVentasMayor>;

  /**
   * Crea una nueva venta al mayor
   */
  create(data: CreateVentaMayorData): Promise<VentaMayor>;

  /**
   * Completa una venta al mayor
   */
  completar(id: string): Promise<VentaMayor>;

  /**
   * Cuenta ventas al mayor por criterio
   */
  count(options?: { vendedorId?: string; estado?: EstadoVentaMayor }): Promise<number>;
}

/**
 * Token de inyección para el repositorio
 */
export const VENTA_MAYOR_REPOSITORY = Symbol('VENTA_MAYOR_REPOSITORY');
