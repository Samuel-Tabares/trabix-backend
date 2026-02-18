import { EstadoEquipamiento } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Entidad de dominio Equipamiento
 * Según sección 10 del documento
 *
 * El equipamiento es voluntario, incluye nevera+pijama.
 * Es propiedad de TRABIX y requiere mensualidad.
 *
 * Estados:
 * - SOLICITADO: Vendedor solicitó, esperando entrega del admin
 * - ACTIVO: Admin entregó, vendedor lo tiene físicamente
 * - DEVUELTO: Vendedor devolvió el equipamiento al admin
 * - PERDIDO: Vendedor perdió TODOo el equipamiento (genera deuda total)
 * - DANADO: (DEPRECATED - daños solo generan deuda, no cambian estado)
 *
 * Flujo de deudas:
 * - Las deudas (mensualidad, daños, pérdida) se descuentan automáticamente en los cuadres
 * - Un vendedor no puede continuar con tandas hasta saldar deudas
 */
export class EquipamientoEntity {
  readonly id: string;
  readonly vendedorId: string;
  readonly estado: EstadoEquipamiento;
  readonly tieneDeposito: boolean;
  readonly depositoPagado: Decimal | null;
  readonly mensualidadActual: Decimal;
  readonly ultimaMensualidadPagada: Date | null;
  readonly deudaDano: Decimal;
  readonly deudaPerdida: Decimal;
  readonly fechaSolicitud: Date;
  readonly fechaEntrega: Date | null;
  readonly fechaDevolucion: Date | null;
  readonly depositoDevuelto: boolean;
  readonly fechaDevolucionDeposito: Date | null;

  constructor(props: EquipamientoEntityProps) {
    this.id = props.id;
    this.vendedorId = props.vendedorId;
    this.estado = props.estado;
    this.tieneDeposito = props.tieneDeposito;
    this.depositoPagado = props.depositoPagado ? new Decimal(props.depositoPagado) : null;
    this.mensualidadActual = new Decimal(props.mensualidadActual);
    this.ultimaMensualidadPagada = props.ultimaMensualidadPagada;
    this.deudaDano = new Decimal(props.deudaDano || 0);
    this.deudaPerdida = new Decimal(props.deudaPerdida || 0);
    this.fechaSolicitud = props.fechaSolicitud;
    this.fechaEntrega = props.fechaEntrega;
    this.fechaDevolucion = props.fechaDevolucion;
    this.depositoDevuelto = props.depositoDevuelto;
    this.fechaDevolucionDeposito = props.fechaDevolucionDeposito;
  }
  /**
   * Calcula la deuda total de equipamiento (daños + pérdida)
   * NO incluye mensualidad pendiente - eso se calcula aparte
   */
  get deudaTotal(): Decimal {
    return this.deudaDano.plus(this.deudaPerdida);
  }

  /**
   * Verifica si la mensualidad está al día
   * La mensualidad debe pagarse cada 30 días desde la última fecha de pago
   */
  mensualidadAlDia(): boolean {
    if (!this.ultimaMensualidadPagada || !this.fechaEntrega) {
      return false;
    }

    const ahora = new Date();
    const ultimoPago = new Date(this.ultimaMensualidadPagada);
    const diasDesdeUltimoPago = Math.floor(
      (ahora.getTime() - ultimoPago.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Mensualidad es por 30 días
    return diasDesdeUltimoPago <= 30;
  }

  /**
   * Calcula los días de mora en mensualidad
   */
  diasMoraMensualidad(): number {
    if (!this.ultimaMensualidadPagada || !this.fechaEntrega) {
      return 0;
    }

    const ahora = new Date();
    const ultimoPago = new Date(this.ultimaMensualidadPagada);
    const diasDesdeUltimoPago = Math.floor(
      (ahora.getTime() - ultimoPago.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, diasDesdeUltimoPago - 30);
  }

  /**
   * Calcula mensualidades pendientes (cantidad de períodos de 30 días sin pagar)
   */
  mensualidadesPendientes(): number {
    if (!this.ultimaMensualidadPagada || !this.fechaEntrega) {
      return 0;
    }

    const ahora = new Date();
    const ultimoPago = new Date(this.ultimaMensualidadPagada);
    const diasDesdeUltimoPago = Math.floor(
      (ahora.getTime() - ultimoPago.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Cada 30 días es una mensualidad
    return Math.max(0, Math.floor(diasDesdeUltimoPago / 30));
  }

  /**
   * Calcula el monto total de mensualidades pendientes
   */
  montoMensualidadesPendientes(): Decimal {
    const pendientes = this.mensualidadesPendientes();
    return this.mensualidadActual.times(pendientes);
  }

  /**
   * Indica si el vendedor tiene alguna deuda de equipamiento
   * (incluye daños, pérdida y mensualidades pendientes)
   */
  tieneDeuda(): boolean {
    return this.deudaTotal.greaterThan(0) || this.mensualidadesPendientes() > 0;
  }

  /**
   * Calcula la deuda total incluyendo mensualidades pendientes
   * Este es el monto que debe entrar en los cuadres
   */
  deudaTotalConMensualidades(): Decimal {
    return this.deudaTotal.plus(this.montoMensualidadesPendientes());
  }

  /**
   * Valida que se puede activar el equipamiento (SOLICITADO → ACTIVO)
   * Solo admin puede ejecutar esta acción
   */
  validarActivacion(): void {
    if (this.estado !== 'SOLICITADO') {
      throw new DomainException(
        'EQU_001',
        'Solo se puede activar equipamiento en estado SOLICITADO',
        { estadoActual: this.estado },
      );
    }
  }

  /**
   * Valida que se puede devolver el equipamiento (ACTIVO → DEVUELTO)
   * Solo admin puede ejecutar esta acción
   * Requiere que no haya deudas pendientes
   */
  validarDevolucion(): void {
    if (this.estado !== 'ACTIVO') {
      throw new DomainException('EQU_002', 'Solo se puede devolver equipamiento en estado ACTIVO', {
        estadoActual: this.estado,
      });
    }

    if (this.tieneDeuda()) {
      throw new DomainException(
        'EQU_010',
        'No se puede devolver equipamiento con deudas pendientes',
        {
          deudaDano: this.deudaDano.toFixed(2),
          deudaPerdida: this.deudaPerdida.toFixed(2),
          mensualidadesPendientes: this.mensualidadesPendientes(),
          deudaTotal: this.deudaTotalConMensualidades().toFixed(2),
        },
      );
    }
  }

  /**
   * Valida que se puede reportar daño
   * Solo admin puede ejecutar esta acción
   * Solo aplica a equipamiento ACTIVO
   */
  validarReporteDano(): void {
    if (this.estado !== 'ACTIVO') {
      throw new DomainException('EQU_003', 'Solo se puede reportar daño en equipamiento ACTIVO', {
        estadoActual: this.estado,
      });
    }
  }

  /**
   * Valida que se puede reportar pérdida total
   * Solo admin puede ejecutar esta acción
   * Solo aplica a equipamiento ACTIVO
   */
  validarReportePerdida(): void {
    if (this.estado !== 'ACTIVO') {
      throw new DomainException(
        'EQU_004',
        'Solo se puede reportar pérdida en equipamiento ACTIVO',
        { estadoActual: this.estado },
      );
    }
  }
}

/**
 * Props para crear una entidad Equipamiento
 */
export interface EquipamientoEntityProps {
  id: string;
  vendedorId: string;
  estado: EstadoEquipamiento;
  tieneDeposito: boolean;
  depositoPagado: Decimal | string | number | null;
  mensualidadActual: Decimal | string | number;
  ultimaMensualidadPagada: Date | null;
  deudaDano?: Decimal | string | number;
  deudaPerdida?: Decimal | string | number;
  fechaSolicitud: Date;
  fechaEntrega: Date | null;
  fechaDevolucion: Date | null;
  depositoDevuelto: boolean;
  fechaDevolucionDeposito: Date | null;
}
