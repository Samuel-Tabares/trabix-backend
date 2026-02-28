import { ModalidadVentaMayor, EstadoVentaMayor } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Tipos de fuente de stock
 */
export type TipoFuenteStock = 'RESERVADO' | 'EN_CASA' | 'LOTE_FORZADO';

/**
 * Fuente de stock para venta al mayor
 */
export interface FuenteStock {
  tandaId: string;
  cantidadConsumida: number;
  tipoStock: TipoFuenteStock;
}

/**
 * Entidad de dominio VentaMayor
 * Según sección 7 del documento
 *
 * Una venta al mayor es una venta de >20 unidades que:
 * - Se gestiona directamente con Admin
 * - Tiene transferencia de dinero inmediata a Admin
 * - Puede consumir stock de múltiples fuentes
 * - Genera un CUADRE AL MAYOR único
 *
 * NOTA: Los cálculos de precio se realizan en CalculadoraPreciosMayorService
 * para mantener la entidad pura (sin dependencias de infraestructura/configuración)
 */
export class VentaMayorEntity {
  readonly id: string;
  readonly vendedorId: string;
  readonly cantidadUnidades: number;
  readonly precioUnidad: Decimal;
  readonly ingresoBruto: Decimal;
  readonly conLicor: boolean;
  readonly modalidad: ModalidadVentaMayor;
  readonly estado: EstadoVentaMayor;
  readonly fuentesStock: FuenteStock[];
  readonly lotesInvolucradosIds: string[];
  readonly loteForzadoId: string | null;
  readonly fechaRegistro: Date;
  readonly fechaCompletada: Date | null;

  constructor(props: VentaMayorEntityProps) {
    this.id = props.id;
    this.vendedorId = props.vendedorId;
    this.cantidadUnidades = props.cantidadUnidades;
    this.precioUnidad = new Decimal(props.precioUnidad);
    this.ingresoBruto = new Decimal(props.ingresoBruto);
    this.conLicor = props.conLicor;
    this.modalidad = props.modalidad;
    this.estado = props.estado;
    this.fuentesStock = props.fuentesStock || [];
    this.lotesInvolucradosIds = props.lotesInvolucradosIds || [];
    this.loteForzadoId = props.loteForzadoId;
    this.fechaRegistro = props.fechaRegistro;
    this.fechaCompletada = props.fechaCompletada;
  }

  /**
   * Valida que se puede completar la venta
   */
  validarCompletar(): void {
    if (this.estado !== 'PENDIENTE') {
      throw new DomainException('VMA_001', 'Solo se pueden completar ventas en estado PENDIENTE', {
        estadoActual: this.estado,
      });
    }
  }

  /**
   * Valida cantidad mínima para venta al mayor (>=10)
   * 10-19 unidades: excepción admin, precio del tramo 20-49
   * >=20 unidades: precio por mayor estándar según tramos
   */
  static validarCantidadMinima(cantidad: number): void {
    if (cantidad < 10) {
      throw new DomainException(
        'VMA_002',
        'La cantidad para venta al mayor debe ser mayor o igual a 10 unidades',
        { cantidad },
      );
    }
  }
}

/**
 * Props para crear una entidad VentaMayor
 */
export interface VentaMayorEntityProps {
  id: string;
  vendedorId: string;
  cantidadUnidades: number;
  precioUnidad: Decimal | string | number;
  ingresoBruto: Decimal | string | number;
  conLicor: boolean;
  modalidad: ModalidadVentaMayor;
  estado: EstadoVentaMayor;
  fuentesStock?: FuenteStock[];
  lotesInvolucradosIds?: string[];
  loteForzadoId: string | null;
  fechaRegistro: Date;
  fechaCompletada: Date | null;
}
