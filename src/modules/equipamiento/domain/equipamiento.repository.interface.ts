import { Equipamiento, EstadoEquipamiento } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Datos para crear equipamiento
 */
export interface CreateEquipamientoData {
  vendedorId: string;
  tieneDeposito: boolean;
  depositoPagado?: Decimal;
  mensualidadActual: Decimal;
}

/**
 * Opciones para listar equipamientos
 */
export interface FindEquipamientosOptions {
  skip?: number;
  take?: number;
  where?: {
    estado?: EstadoEquipamiento;
    vendedorId?: string;
    searchVendedor?: string;
  };
}

/**
 * Resultado paginado
 */
export interface PaginatedEquipamientos {
  data: Equipamiento[];
  total: number;
  hasMore: boolean;
}

/**
 * Interface del repositorio de equipamiento
 */
export interface IEquipamientoRepository {
  /**
   * Busca equipamiento por ID
   */
  findById(id: string): Promise<Equipamiento | null>;

  /**
   * Busca equipamiento por vendedor
   * Un vendedor solo puede tener un equipamiento activo
   */
  findByVendedorId(vendedorId: string): Promise<Equipamiento | null>;

  /**
   * Busca equipamiento activo por vendedor (no devuelto ni perdido)
   */
  findActivoByVendedorId(vendedorId: string): Promise<Equipamiento | null>;

  /**
   * Busca equipamiento vigente por vendedor (SOLICITADO, ACTIVO o PERDIDO)
   * Usado para mostrar info al vendedor incluso cuando el equipo está reportado como perdido
   */
  findVigenteByVendedorId(vendedorId: string): Promise<Equipamiento | null>;

  /**
   * Busca todos los equipamientos vigentes de un vendedor (SOLICITADO, ACTIVO o PERDIDO)
   * Un vendedor puede tener múltiples equipamientos perdidos pendientes de pago
   */
  findAllVigentesByVendedorId(vendedorId: string): Promise<Equipamiento[]>;

  /**
   * Lista equipamientos con filtros
   */
  findAll(options: FindEquipamientosOptions): Promise<PaginatedEquipamientos>;

  /**
   * Crea un nuevo equipamiento (SOLICITADO)
   */
  create(data: CreateEquipamientoData): Promise<Equipamiento>;

  /**
   * Activa el equipamiento (SOLICITADO → ACTIVO)
   * Establece fecha de entrega y primera mensualidad pagada
   */
  activar(id: string): Promise<Equipamiento>;

  /**
   * Reporta daño de nevera o pijama.
   * Marca el componente como dañado y aumenta deudaDano.
   * Si abonoDeposito > 0, el depósito cubre parte/toda la deuda (deudaNeta = monto - abono).
   * Si deudaNeta = 0, no se marcan flags de daño (depósito cubrió el costo).
   * NO cambia el estado.
   */
  reportarDano(
    id: string,
    tipoDano: 'NEVERA' | 'PIJAMA',
    deudaNeta: Decimal,
    abonoDeposito: Decimal,
  ): Promise<Equipamiento>;

  /**
   * Transiciona a PERDIDO automáticamente cuando ambos componentes están dañados.
   * Si el depósito cubre la deuda, el equipo queda en DEVUELTO con flags en false.
   * Si no cubre, establece estado PERDIDO con deudaPerdida.
   */
  transicionarAPerdidoPorDanos(
    id: string,
    deudaNeta: Decimal,
    abonoDeposito: Decimal,
  ): Promise<Equipamiento>;

  /**
   * Reporta pérdida total del equipamiento (ACTIVO → PERDIDO).
   * Si el depósito cubre la deuda, el equipo queda en DEVUELTO con flags en false.
   * Genera deuda por el costo total (nevera + pijama) menos el abono del depósito.
   */
  reportarPerdida(id: string, deudaNeta: Decimal, abonoDeposito: Decimal): Promise<Equipamiento>;

  /**
   * Resetea los flags neveraDanada/pijamaDanada a false.
   * Se llama cuando la deudaDano queda en 0 tras un pago.
   */
  resetearFlagsReparacion(id: string): Promise<Equipamiento>;

  /**
   * Devuelve el equipamiento (ACTIVO → DEVUELTO)
   * Solo si no hay deudas pendientes
   */
  devolver(id: string): Promise<Equipamiento>;

  /**
   * Devuelve el depósito al vendedor
   * Se ejecuta cuando el equipamiento es devuelto sin deudas
   */
  devolverDeposito(id: string): Promise<Equipamiento>;

  /**
   * Registra pago de mensualidad (desde cuadre)
   * Actualiza la fecha de última mensualidad pagada
   */
  registrarPagoMensualidad(id: string): Promise<Equipamiento>;

  /**
   * Reduce deuda de daño (desde cuadre)
   * Se llama cuando el cuadre incluye pago de daño
   */
  reducirDeudaDano(id: string, monto: Decimal): Promise<Equipamiento>;

  /**
   * Reduce deuda de pérdida (desde cuadre)
   * Se llama cuando el cuadre incluye pago de pérdida
   */
  reducirDeudaPerdida(id: string, monto: Decimal): Promise<Equipamiento>;
}

/**
 * Token de inyección para el repositorio
 */
export const EQUIPAMIENTO_REPOSITORY = Symbol('EQUIPAMIENTO_REPOSITORY');
