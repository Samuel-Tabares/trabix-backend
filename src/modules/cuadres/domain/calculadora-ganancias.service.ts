import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModeloNegocio } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Interface para estrategias de cálculo de ganancias
 */
export interface IGananciaStrategy {
  calcular(gananciaTotal: Decimal, jerarquia?: JerarquiaReclutador[]): ResultadoGanancias;
}

/**
 * Representa un reclutador en la jerarquía
 */
export interface JerarquiaReclutador {
  id: string;
  nivel: number; // N-1, N-2, etc. donde N es el vendedor
  nombre?: string;
}

/**
 * Resultado del cálculo de ganancias
 */
export interface ResultadoGanancias {
  gananciaVendedor: Decimal;
  gananciaAdmin: Decimal;
  gananciasReclutadores: GananciaReclutador[];
}

/**
 * Ganancia de un reclutador específico
 */
export interface GananciaReclutador {
  reclutadorId: string;
  nivel: number;
  monto: Decimal;
}

/**
 * Strategy: Modelo 60/40
 * Según sección 16.5 del documento
 *
 * ganancia_vendedor = ganancia_total × porcentaje_vendedor
 * ganancia_admin = ganancia_total × porcentaje_admin
 *
 * Los porcentajes se obtienen de ConfigService.
 */
@Injectable()
export class Modelo6040Strategy implements IGananciaStrategy {
  private readonly porcentajeVendedor: Decimal;
  private readonly porcentajeAdmin: Decimal;

  constructor(private readonly configService: ConfigService) {
    // Cargar porcentajes desde configuración (vienen como 60, 40, etc.)
    const vendedorPct = this.configService.get<number>('porcentajes.vendedor6040') ?? 60;
    const adminPct = this.configService.get<number>('porcentajes.admin6040') ?? 40;

    // Convertir a decimal (0.6, 0.4)
    this.porcentajeVendedor = new Decimal(vendedorPct).dividedBy(100);
    this.porcentajeAdmin = new Decimal(adminPct).dividedBy(100);
  }

  calcular(gananciaTotal: Decimal): ResultadoGanancias {
    const gananciaVendedor = gananciaTotal.times(this.porcentajeVendedor);
    const gananciaAdmin = gananciaTotal.times(this.porcentajeAdmin);

    return {
      gananciaVendedor,
      gananciaAdmin,
      gananciasReclutadores: [],
    };
  }
}

/**
 * Strategy: Modelo 50/50 con Cascada
 * Según sección 16.5 del documento
 *
 * La cascada SIEMPRE divide por 2 (50/50 fijo en cada nivel):
 * - ganancia_vendedor_N = ganancia_total × 0.5
 * - ganancia_reclutador_N-1 = ganancia_vendedor_N × 0.5
 * - ganancia_reclutador_N-2 = ganancia_reclutador_N-1 × 0.5
 * - ... (continúa hasta admin)
 * - ganancia_admin = igual que el último nivel de reclutador (nivel 2)
 *
 * Admin es nivel 1, así que recibe el mismo porcentaje que reclutador nivel 2.
 *
 * Ejemplo con 4 niveles y ganancia_total = $100,000:
 * - Vendedor (N): $100,000 × 0.5 = $50,000
 * - Reclutador (N-1): $50,000 × 0.5 = $25,000
 * - Reclutador (N-2): $25,000 × 0.5 = $12,500
 * - Admin (nivel 1): $12,500 (igual que nivel 2)
 */
@Injectable()
export class Modelo5050CascadaStrategy implements IGananciaStrategy {
  private readonly porcentajeVendedor: Decimal;
  private readonly divisorCascada: Decimal;

  constructor(private readonly configService: ConfigService) {
    // Cargar porcentaje inicial del vendedor desde configuración
    const vendedorPct = this.configService.get<number>('porcentajes.vendedor5050') ?? 50;
    this.porcentajeVendedor = new Decimal(vendedorPct).dividedBy(100);

    // La cascada SIEMPRE divide por 2 (50/50 fijo según regla de negocio)
    this.divisorCascada = new Decimal(0.5);
  }

  calcular(gananciaTotal: Decimal, jerarquia: JerarquiaReclutador[] = []): ResultadoGanancias {
    // Ganancia del vendedor: porcentaje configurado del total
    const gananciaVendedor = gananciaTotal.times(this.porcentajeVendedor);

    const gananciasReclutadores: GananciaReclutador[] = [];
    let gananciaActual = gananciaVendedor;

    // Ordenar jerarquía por nivel (N-1, N-2, etc.)
    const jerarquiaOrdenada = [...jerarquia].sort((a, b) => a.nivel - b.nivel);

    // Calcular ganancia para cada reclutador en la cascada
    // Cada nivel recibe 50% del nivel anterior (división fija)
    for (const reclutador of jerarquiaOrdenada) {
      const gananciaReclutador = gananciaActual.times(this.divisorCascada);
      gananciasReclutadores.push({
        reclutadorId: reclutador.id,
        nivel: reclutador.nivel,
        monto: gananciaReclutador,
      });
      gananciaActual = gananciaReclutador;
    }

    // Según documento: ganancia_admin = ganancia_ultimo_reclutador
    // Si no hay reclutadores, 50/50 directo con vendedor
    const gananciaAdmin =
      jerarquiaOrdenada.length > 0
        ? gananciaActual // Admin recibe igual que el último nivel calculado
        : gananciaTotal.times(this.divisorCascada);

    return {
      gananciaVendedor,
      gananciaAdmin,
      gananciasReclutadores,
    };
  }
}

/**
 * Domain Service: Calculadora de Ganancias
 * Según sección 16.5 del documento
 *
 * Utiliza el patrón Strategy para calcular ganancias según el modelo de negocio:
 * - MODELO_60_40: 60% vendedor, 40% admin (configurable vía .env)
 * - MODELO_50_50: 50% vendedor, 50% se divide en cascada entre reclutadores
 */
@Injectable()
export class CalculadoraGananciasService {
  private readonly strategies: Map<ModeloNegocio, IGananciaStrategy>;

  constructor(
    private readonly modelo6040: Modelo6040Strategy,
    private readonly modelo5050: Modelo5050CascadaStrategy,
  ) {
    this.strategies = new Map<ModeloNegocio, IGananciaStrategy>([
      ['MODELO_60_40', this.modelo6040],
      ['MODELO_50_50', this.modelo5050],
    ]);
  }

  /**
   * Calcula las ganancias según el modelo de negocio
   *
   * @param dineroRecaudado Dinero total recaudado
   * @param inversionTotal Inversión total del lote
   * @param modelo Modelo de negocio (60/40 o 50/50)
   * @param jerarquia Jerarquía de reclutadores (solo para 50/50)
   */
  calcularGanancias(
    dineroRecaudado: Decimal,
    inversionTotal: Decimal,
    modelo: ModeloNegocio,
    jerarquia?: JerarquiaReclutador[],
  ): ResultadoCalculoGanancias {
    // ganancia_total = dinero_recaudado - inversion_total
    // Condición: ganancia_total solo existe cuando dinero_recaudado > inversion_total
    const gananciaTotal = dineroRecaudado.minus(inversionTotal);

    if (gananciaTotal.lessThanOrEqualTo(0)) {
      return {
        hayGanancias: false,
        gananciaTotal: new Decimal(0),
        gananciaVendedor: new Decimal(0),
        gananciaAdmin: new Decimal(0),
        gananciasReclutadores: [],
      };
    }

    const strategy = this.strategies.get(modelo);
    if (!strategy) {
      throw new Error(`Modelo de negocio no soportado: ${modelo}`);
    }

    const resultado = strategy.calcular(gananciaTotal, jerarquia);

    return {
      hayGanancias: true,
      gananciaTotal,
      ...resultado,
    };
  }
}

/**
 * Resultado completo del cálculo de ganancias
 */
export interface ResultadoCalculoGanancias {
  hayGanancias: boolean;
  gananciaTotal: Decimal;
  gananciaVendedor: Decimal;
  gananciaAdmin: Decimal;
  gananciasReclutadores: GananciaReclutador[];
}
