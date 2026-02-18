import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';

/**
 * Servicio de dominio para cálculos de tandas
 * Según sección 16.1 del documento
 *
 * División de tandas:
 * - SI cantidad_trabix <= umbral: 2 tandas (50% / 50%)
 * - SI cantidad_trabix > umbral: 3 tandas (~33.3%)
 *
 * Regla de redondeo: >= 0.5 redondea hacia arriba, < 0.5 redondea hacia abajo.
 * La diferencia por redondeo se asigna a las primeras tandas.
 *
 * Todos los valores se cargan desde configuración.
 */
@Injectable()
export class CalculadoraTandasService {
  private readonly umbralTandasTres: number;
  private readonly triggerCuadreT2: number;
  private readonly triggerCuadreT3: number;
  private readonly triggerCuadreT1_2Tandas: number;
  private readonly triggerCuadreT2_2Tandas: number;

  constructor(private readonly configService: ConfigService) {
    // Cargar configuración desde .env
    this.umbralTandasTres = this.configService.get<number>('lotes.umbralTandasTres') ?? 50;

    // Los triggers vienen como porcentaje (ej: 10 para 10%)
    this.triggerCuadreT2 = this.configService.get<number>('porcentajes.triggerCuadreT2') ?? 10;
    this.triggerCuadreT3 = this.configService.get<number>('porcentajes.triggerCuadreT3') ?? 20;
    this.triggerCuadreT1_2Tandas =
      this.configService.get<number>('porcentajes.triggerCuadreT1_2Tandas') ?? 10;
    this.triggerCuadreT2_2Tandas =
      this.configService.get<number>('porcentajes.triggerCuadreT2_2Tandas') ?? 20;
  }

  /**
   * Calcula la distribución de TRABIX en tandas
   */
  calcularDistribucionTandas(cantidadTrabix: number): DistribucionTandas[] {
    if (cantidadTrabix <= this.umbralTandasTres) {
      return this.calcularDosTandas(cantidadTrabix);
    }
    return this.calcularTresTandas(cantidadTrabix);
  }

  /**
   * Calcula distribución para 2 tandas (≤umbral TRABIX)
   */
  private calcularDosTandas(cantidadTrabix: number): DistribucionTandas[] {
    const tanda1 = Math.round(cantidadTrabix * 0.49);
    const tanda2 = cantidadTrabix - tanda1;

    return [
      { numero: 1, stockInicial: tanda1 },
      { numero: 2, stockInicial: tanda2 },
    ];
  }

  /**
   * Calcula distribución para 3 tandas (>umbral TRABIX)
   */
  private calcularTresTandas(cantidadTrabix: number): DistribucionTandas[] {
    const tanda1 = Math.round(cantidadTrabix * 0.333);
    const tanda2 = Math.round(cantidadTrabix * 0.333);
    const tanda3 = cantidadTrabix - tanda1 - tanda2;

    return [
      { numero: 1, stockInicial: tanda1 },
      { numero: 2, stockInicial: tanda2 },
      { numero: 3, stockInicial: tanda3 },
    ];
  }

  /**
   * Verifica si se debe disparar un cuadre basado en el stock restante
   *
   * LOTE 3 TANDAS:
   * - Cuadre T1: dinero_recaudado >= inversion_admin
   * - Cuadre T2: stock_actual_T2 <= stock_inicial_T2 × trigger_t2%
   * - Cuadre T3: stock_actual_T3 <= stock_inicial_T3 × trigger_t3%
   *
   * LOTE 2 TANDAS:
   * - Cuadre T1: stock_actual_T1 <= stock_inicial_T1 × trigger_t1%
   * - Cuadre T2: stock_actual_T2 <= stock_inicial_T2 × trigger_t2%
   */
  verificarTriggerCuadre(
    numeroTanda: number,
    totalTandas: number,
    stockActual: number,
    stockInicial: number,
    dineroRecaudado: Decimal,
    inversionAdmin: Decimal,
  ): TriggerCuadreResult {
    const porcentajeStock = stockInicial > 0 ? (stockActual / stockInicial) * 100 : 0;

    // Lote de 3 tandas
    if (totalTandas === 3) {
      switch (numeroTanda) {
        case 1: // Cuadre T1: dinero_recaudado >= inversion_admin
        {
          const disparaT1 = dineroRecaudado.greaterThanOrEqualTo(inversionAdmin);
          return {
            debeDisparar: disparaT1,
            razon: disparaT1 ? 'INVERSION_RECUPERADA' : null,
            porcentajeStock,
          };
        }
        case 2: // Cuadre T2: stock_actual <= stock_inicial × trigger_t2%
        {
          const umbralT2 = stockInicial * (this.triggerCuadreT2 / 100);
          const disparaT2 = stockActual <= umbralT2;
          return {
            debeDisparar: disparaT2,
            razon: disparaT2 ? 'STOCK_BAJO_PORCENTAJE' : null,
            porcentajeStock,
            umbralPorcentaje: this.triggerCuadreT2,
          };
        }
        case 3: // Cuadre T3: stock_actual <= stock_inicial × trigger_t3%
        {
          const umbralT3 = stockInicial * (this.triggerCuadreT3 / 100);
          const disparaT3 = stockActual <= umbralT3;
          return {
            debeDisparar: disparaT3,
            razon: disparaT3 ? 'STOCK_BAJO_PORCENTAJE' : null,
            porcentajeStock,
            umbralPorcentaje: this.triggerCuadreT3,
          };
        }
      }
    }

    // Lote de 2 tandas
    if (totalTandas === 2) {
      switch (numeroTanda) {
        case 1: // Cuadre T1: stock_actual <= stock_inicial × trigger_t1_2tandas%
        {
          const umbralT1_2Tandas = stockInicial * (this.triggerCuadreT1_2Tandas / 100);
          const disparaT1_2Tandas = stockActual <= umbralT1_2Tandas;
          return {
            debeDisparar: disparaT1_2Tandas,
            razon: disparaT1_2Tandas ? 'STOCK_BAJO_PORCENTAJE' : null,
            porcentajeStock,
            umbralPorcentaje: this.triggerCuadreT1_2Tandas,
          };
        }
        case 2: // Cuadre T2: stock_actual <= stock_inicial × trigger_t2_2tandas%
        {
          const umbralT2_2Tandas = stockInicial * (this.triggerCuadreT2_2Tandas / 100);
          const disparaT2_2Tandas = stockActual <= umbralT2_2Tandas;
          return {
            debeDisparar: disparaT2_2Tandas,
            razon: disparaT2_2Tandas ? 'STOCK_BAJO_PORCENTAJE' : null,
            porcentajeStock,
            umbralPorcentaje: this.triggerCuadreT2_2Tandas,
          };
        }
      }
    }

    return {
      debeDisparar: false,
      razon: null,
      porcentajeStock,
    };
  }
}

/**
 * Distribución de una tanda
 */
export interface DistribucionTandas {
  numero: number;
  stockInicial: number;
}

/**
 * Resultado de verificar trigger de cuadre
 */
export interface TriggerCuadreResult {
  debeDisparar: boolean;
  razon: 'INVERSION_RECUPERADA' | 'STOCK_BAJO_PORCENTAJE' | null;
  porcentajeStock: number;
  umbralPorcentaje?: number;
}
