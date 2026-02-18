import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Configuración del fondo de recompensas
 * Según sección 12 del documento
 */

/**
 * Tipo de movimiento del fondo
 */
export type TipoMovimientoFondo = 'ENTRADA' | 'SALIDA';

/**
 * Interface del movimiento del fondo
 */
export interface MovimientoFondo {
  id: string;
  tipo: TipoMovimientoFondo;
  monto: Decimal;
  concepto: string;
  loteId?: string;
  vendedorBeneficiarioId?: string; // Solo para salidas (premios)
  fechaTransaccion: Date;
}

/**
 * Domain Service: Fondo de Recompensas
 * Según sección 12 del documento
 *
 * Es un fondo global administrado por Admin para premiar vendedores destacados.
 * - Se alimenta automáticamente al activar lotes ($200 por TRABIX)
 * - Admin registra retiros manualmente indicando el beneficiario
 * - El fondo no puede quedar en negativo
 * - Todos pueden ver el saldo y transacciones
 */
@Injectable()
export class FondoRecompensasService {
  /**
   * Valida que se puede realizar una salida
   */
  validarSalida(saldoActual: Decimal, montoSalida: Decimal): void {
    if (montoSalida.lessThanOrEqualTo(0)) {
      throw new DomainException('FND_001', 'El monto de salida debe ser mayor a 0');
    }

    if (saldoActual.minus(montoSalida).lessThan(0)) {
      throw new DomainException('FND_002', 'El fondo no puede quedar en negativo', {
        saldoActual: saldoActual.toFixed(2),
        montoSalida: montoSalida.toFixed(2),
        disponible: saldoActual.toFixed(2),
      });
    }
  }
}

// ========== Repository Interface ==========

export interface CreateMovimientoData {
  tipo: TipoMovimientoFondo;
  monto: Decimal;
  concepto: string;
  loteId?: string;
  vendedorBeneficiarioId?: string; // Solo para salidas
}

export interface IFondoRecompensasRepository {
  /**
   * Obtiene el saldo actual del fondo
   */
  obtenerSaldo(): Promise<Decimal>;

  /**
   * Lista movimientos del fondo
   */
  listarMovimientos(options: {
    skip?: number;
    take?: number;
    tipo?: TipoMovimientoFondo;
  }): Promise<{
    data: MovimientoFondo[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Registra una entrada al fondo
   */
  registrarEntrada(data: CreateMovimientoData): Promise<MovimientoFondo>;

  /**
   * Registra una salida del fondo
   */
  registrarSalida(data: CreateMovimientoData): Promise<MovimientoFondo>;
}

export const FONDO_RECOMPENSAS_REPOSITORY = Symbol('FONDO_RECOMPENSAS_REPOSITORY');
