import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TipoVenta } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Cantidad de TRABIX por tipo de venta
 * Estos valores son FIJOS por definición del negocio
 */
export const TRABIX_POR_TIPO: Record<TipoVenta, number> = {
  PROMO: 2,        // PROMO consume 2 TRABIX
  PROMO_PARCIAL: 1, // Media promo (cross-lote): consume 1 TRABIX
  UNIDAD: 1,       // UNIDAD consume 1 TRABIX
  SIN_LICOR: 1,    // SIN_LICOR consume 1 TRABIX
  REGALO: 1,       // REGALO consume 1 TRABIX
};

/**
 * Detalle de venta para cálculo
 */
export interface DetalleVentaParaCalculo {
  tipo: TipoVenta;
  cantidad: number;
}

/**
 * Resultado del cálculo de precios
 */
export interface ResultadoCalculoVenta {
  detallesConPrecios: DetalleConPrecio[];
  montoTotal: Decimal;
  cantidadTrabixTotal: number;
}

/**
 * Detalle con precio calculado
 */
export interface DetalleConPrecio {
  tipo: TipoVenta;
  cantidad: number;
  precioUnitario: Decimal;
  subtotal: Decimal;
}

/**
 * Domain Service: Calculadora de Precios de Venta al Detal
 * Según sección 16.3 del documento
 *
 * Precios de venta:
 * - PROMO: 2 TRABIX con licor (configurable)
 * - UNIDAD: 1 TRABIX con licor (configurable)
 * - SIN_LICOR: 1 TRABIX sin licor (configurable)
 * - REGALO: $0 (siempre)
 *
 * Todos los precios se cargan desde configuración.
 */
@Injectable()
export class CalculadoraPreciosVentaService {
  private readonly precioPromo: Decimal;
  private readonly precioUnidad: Decimal;
  private readonly precioSinLicor: Decimal;

  constructor(private readonly configService: ConfigService) {
    // Cargar precios desde configuración
    this.precioPromo = new Decimal(
      this.configService.get<number>('business.precioPromoLicor') ?? 12000,
    );

    this.precioUnidad = new Decimal(
      this.configService.get<number>('business.precioUnidadLicor') ?? 8000,
    );

    this.precioSinLicor = new Decimal(
      this.configService.get<number>('business.precioUnidadSinLicor') ?? 7000,
    );
  }

  /**
   * Obtiene el precio unitario para un tipo de venta
   */
  obtenerPrecioUnitario(tipo: TipoVenta): Decimal {
    switch (tipo) {
      case 'PROMO':
        return this.precioPromo;
      case 'PROMO_PARCIAL':
        // Media promo: precio exactamente la mitad de una PROMO completa
        return this.precioPromo.dividedBy(2);
      case 'UNIDAD':
        return this.precioUnidad;
      case 'SIN_LICOR':
        return this.precioSinLicor;
      case 'REGALO':
        return new Decimal(0);
      default:
        throw new Error(`Tipo de venta no soportado: ${tipo}`);
    }
  }
  /**
   * Calcula la cantidad total de TRABIX de una venta
   */
  calcularCantidadTrabix(detalles: DetalleVentaParaCalculo[]): number {
    return detalles.reduce((sum, detalle) => {
      return sum + detalle.cantidad * TRABIX_POR_TIPO[detalle.tipo];
    }, 0);
  }

  /**
   * Calcula todos los precios de una venta
   */
  calcularVenta(detalles: DetalleVentaParaCalculo[]): ResultadoCalculoVenta {
    const detallesConPrecios: DetalleConPrecio[] = detalles.map((detalle) => {
      const precioUnitario = this.obtenerPrecioUnitario(detalle.tipo);
      const subtotal = precioUnitario.times(detalle.cantidad);

      return {
        tipo: detalle.tipo,
        cantidad: detalle.cantidad,
        precioUnitario,
        subtotal,
      };
    });

    const montoTotal = detallesConPrecios.reduce((sum, d) => sum.plus(d.subtotal), new Decimal(0));

    const cantidadTrabixTotal = this.calcularCantidadTrabix(detalles);

    return {
      detallesConPrecios,
      montoTotal,
      cantidadTrabixTotal,
    };
  }
}
