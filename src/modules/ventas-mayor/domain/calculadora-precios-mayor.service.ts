import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';

/**
 * Rango de precios al mayor
 */
interface RangoPrecioMayor {
  minCantidad: number;
  precio: Decimal;
}

/**
 * Domain Service: Calculadora de Precios al Mayor
 * Según sección 16.4 del documento
 *
 * Rangos de precios:
 * - >=100 unidades: precio más bajo
 * - 50-99 unidades: precio medio
 * - 20-49 unidades: precio más alto
 *
 * Los precios varían según si es con licor o sin licor.
 * Todos los valores se cargan desde configuración.
 */
@Injectable()
export class CalculadoraPreciosMayorService {
  private readonly preciosConLicor: RangoPrecioMayor[];
  private readonly preciosSinLicor: RangoPrecioMayor[];

  constructor(private readonly configService: ConfigService) {
    // Cargar precios CON LICOR desde configuración
    // Orden: del rango más alto al más bajo (100+, 50-99, 20-49)
    this.preciosConLicor = [
      {
        minCantidad: 100,
        precio: new Decimal(this.configService.get<number>('business.precioMayor100Licor') ?? 4500),
      },
      {
        minCantidad: 50,
        precio: new Decimal(this.configService.get<number>('business.precioMayor50Licor') ?? 4700),
      },
      {
        minCantidad: 20,
        precio: new Decimal(this.configService.get<number>('business.precioMayor20Licor') ?? 4900),
      },
    ];

    // Cargar precios SIN LICOR desde configuración
    this.preciosSinLicor = [
      {
        minCantidad: 100,
        precio: new Decimal(
          this.configService.get<number>('business.precioMayor100SinLicor') ?? 4200,
        ),
      },
      {
        minCantidad: 50,
        precio: new Decimal(
          this.configService.get<number>('business.precioMayor50SinLicor') ?? 4500,
        ),
      },
      {
        minCantidad: 20,
        precio: new Decimal(
          this.configService.get<number>('business.precioMayor20SinLicor') ?? 4800,
        ),
      },
    ];
  }

  /**
   * Calcula el precio unitario según cantidad y tipo
   * Según sección 16.4
   *
   * @param cantidad Cantidad de unidades (debe ser >=20)
   * @param conLicor true si es con licor, false si es sin licor
   */
  calcularPrecioUnidad(cantidad: number, conLicor: boolean): Decimal {
    const precios = conLicor ? this.preciosConLicor : this.preciosSinLicor;

    // Buscar el rango de precio correspondiente
    for (const rango of precios) {
      if (cantidad >= rango.minCantidad) {
        return rango.precio;
      }
    }

    // Por defecto el precio del rango más bajo (20-49)
    return precios[precios.length - 1].precio;
  }

  /**
   * Calcula el ingreso bruto de una venta al mayor
   * ingreso_bruto_mayor = cantidad × precio_unidad
   */
  calcularIngresoBruto(cantidad: number, precioUnidad: Decimal): Decimal {
    return precioUnidad.times(cantidad);
  }

  /**
   * Calcula precio unitario e ingreso bruto en una sola llamada
   */
  calcularVentaMayor(cantidad: number, conLicor: boolean): ResultadoCalculoVentaMayor {
    const precioUnidad = this.calcularPrecioUnidad(cantidad, conLicor);
    const ingresoBruto = this.calcularIngresoBruto(cantidad, precioUnidad);

    return {
      precioUnidad,
      ingresoBruto,
      cantidad,
      conLicor,
    };
  }
}

/**
 * Resultado del cálculo de venta al mayor
 */
export interface ResultadoCalculoVentaMayor {
  precioUnidad: Decimal;
  ingresoBruto: Decimal;
  cantidad: number;
  conLicor: boolean;
}
