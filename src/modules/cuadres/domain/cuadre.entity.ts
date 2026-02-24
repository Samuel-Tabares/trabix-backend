import { EstadoCuadre, ConceptoCuadre } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Entidad de dominio Cuadre
 * Según sección 8 del documento
 *
 * Un CUADRE NORMAL agrupa el dinero que el vendedor debe transferir al Admin:
 * - Inversión de admin (si aplica)
 * - Ganancias de admin (si aplica)
 * - Mensualidad de equipamiento (si aplica)
 * - Pago por daño o pérdida de equipamiento (si aplica)
 *
 * Estados:
 * - INACTIVO: aún no se cumple el trigger
 * - PENDIENTE: trigger cumplido, esperando transferencia
 * - EXITOSO: admin confirmó transferencia completa
 */
export class CuadreEntity {
  readonly id: string;
  readonly tandaId: string;
  readonly estado: EstadoCuadre;
  readonly concepto: ConceptoCuadre;
  readonly montoEsperado: Decimal;
  readonly montoRecibido: Decimal;
  readonly montoFaltante: Decimal;
  readonly montoCubiertoPorMayor: Decimal;
  readonly cerradoPorCuadreMayorId: string | null;
  readonly fechaPendiente: Date | null;
  readonly fechaExitoso: Date | null;
  readonly version: number;

  constructor(props: CuadreEntityProps) {
    this.id = props.id;
    this.tandaId = props.tandaId;
    this.estado = props.estado;
    this.concepto = props.concepto;
    this.montoEsperado = new Decimal(props.montoEsperado);
    this.montoRecibido = new Decimal(props.montoRecibido);
    this.montoFaltante = new Decimal(props.montoFaltante);
    this.montoCubiertoPorMayor = new Decimal(props.montoCubiertoPorMayor);
    this.cerradoPorCuadreMayorId = props.cerradoPorCuadreMayorId;
    this.fechaPendiente = props.fechaPendiente;
    this.fechaExitoso = props.fechaExitoso;
    this.version = props.version;
  }

  /**
   * Monto esperado ajustado (restando lo cubierto por mayor)
   */
  get montoEsperadoAjustado(): Decimal {
    return this.montoEsperado.minus(this.montoCubiertoPorMayor);
  }
  /**
   * Valida si el cuadre puede ser activado (INACTIVO → PENDIENTE)
   */
  validarActivacion(): void {
    if (this.estado !== 'INACTIVO') {
      throw new DomainException('CUA_001', 'Solo se pueden activar cuadres en estado INACTIVO', {
        estadoActual: this.estado,
      });
    }
  }

  /**
   * Valida si el cuadre puede ser confirmado
   * Permite montos parciales (el faltante queda registrado en montoFaltante)
   */
  validarConfirmacion(montoRecibido: Decimal): void {
    if (this.estado !== 'PENDIENTE') {
      throw new DomainException('CUA_002', 'Solo se pueden confirmar cuadres en estado PENDIENTE', {
        estadoActual: this.estado,
      });
    }

    if (montoRecibido.lessThanOrEqualTo(0)) {
      throw new DomainException('CUA_003', 'El monto recibido debe ser mayor a cero', {
        montoRecibido: montoRecibido.toFixed(2),
      });
    }
  }
}

/**
 * Props para crear una entidad Cuadre
 */
export interface CuadreEntityProps {
  id: string;
  tandaId: string;
  estado: EstadoCuadre;
  concepto: ConceptoCuadre;
  montoEsperado: Decimal | string | number;
  montoRecibido: Decimal | string | number;
  montoFaltante: Decimal | string | number;
  montoCubiertoPorMayor: Decimal | string | number;
  cerradoPorCuadreMayorId: string | null;
  fechaPendiente: Date | null;
  fechaExitoso: Date | null;
  version: number;
}
