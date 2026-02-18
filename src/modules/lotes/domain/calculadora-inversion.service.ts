import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';

/**
 * Servicio de dominio para cálculos de inversión
 * Según sección 16.2 del documento
 *
 * Fórmulas:
 * - inversion_total = cantidad_trabix × costo_percibido
 * - inversion_admin = inversion_total × (1 - porcentaje_inversion_vendedor)
 * - inversion_vendedor = inversion_total × porcentaje_inversion_vendedor
 *
 * Todos los valores se cargan desde configuración.
 */
@Injectable()
export class CalculadoraInversionService {
  private readonly costoPercibido: Decimal;
  private readonly porcentajeInversionVendedor: Decimal;
  private readonly aporteFondoPorTrabix: Decimal;
  private readonly limiteRegalos: number;

  constructor(private readonly configService: ConfigService) {
    // Cargar configuración desde .env
    this.costoPercibido = new Decimal(
      this.configService.get<number>('business.costoPercibidoTrabix') ?? 2400,
    );

    // El porcentaje viene como 50 (%), lo convertimos a 0.5
    const porcentajeConfig = this.configService.get<number>('porcentajes.inversion') ?? 50;
    this.porcentajeInversionVendedor = new Decimal(porcentajeConfig).dividedBy(100);

    this.aporteFondoPorTrabix = new Decimal(
      this.configService.get<number>('business.aporteFondoPorTrabix') ?? 200,
    );

    // El límite viene como 8 (%), lo usamos como porcentaje
    this.limiteRegalos = this.configService.get<number>('porcentajes.limiteRegalos') ?? 8;
  }

  /**
   * Calcula la inversión total de un lote
   */
  calcularInversionTotal(cantidadTrabix: number): Decimal {
    return this.costoPercibido.times(cantidadTrabix);
  }

  /**
   * Calcula la inversión del admin
   */
  calcularInversionAdmin(inversionTotal: Decimal): Decimal {
    const porcentajeAdmin = new Decimal(1).minus(this.porcentajeInversionVendedor);
    return inversionTotal.times(porcentajeAdmin);
  }

  /**
   * Calcula la inversión del vendedor
   */
  calcularInversionVendedor(inversionTotal: Decimal): Decimal {
    return inversionTotal.times(this.porcentajeInversionVendedor);
  }

  /**
   * Calcula todas las inversiones de un lote
   */
  calcularInversiones(cantidadTrabix: number): InversionesLote {
    const inversionTotal = this.calcularInversionTotal(cantidadTrabix);
    const inversionAdmin = this.calcularInversionAdmin(inversionTotal);
    const inversionVendedor = this.calcularInversionVendedor(inversionTotal);

    return {
      inversionTotal,
      inversionAdmin,
      inversionVendedor,
    };
  }

  /**
   * Calcula el aporte al fondo de recompensas
   * Según sección 16.9
   */
  calcularAporteFondo(cantidadTrabix: number): Decimal {
    return this.aporteFondoPorTrabix.times(cantidadTrabix);
  }

  /**
   * Calcula el máximo de regalos permitidos
   * Según sección 16.11: maximo_regalos = REDONDEAR_ABAJO(cantidad_lote × limite_regalos%)
   */
  calcularMaximoRegalos(cantidadTrabix: number): number {
    return Math.floor(cantidadTrabix * (this.limiteRegalos / 100));
  }
}

/**
 * Resultado del cálculo de inversiones
 */
export interface InversionesLote {
  inversionTotal: Decimal;
  inversionAdmin: Decimal;
  inversionVendedor: Decimal;
}
