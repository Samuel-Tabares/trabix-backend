import { Injectable } from '@nestjs/common';
import { ModeloNegocio } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { EvaluacionFinanciera, GananciaReclutadorMayor } from './cuadre-mayor.entity';
import {
  CalculadoraGananciasService,
  JerarquiaReclutador,
} from '../../cuadres/domain/calculadora-ganancias.service';

/**
 * Información de lote para evaluación financiera
 */
export interface LoteParaEvaluacion {
  id: string;
  inversionAdmin: Decimal;
  inversionVendedor: Decimal;
  dineroRecaudado: Decimal;
  dineroTransferido: Decimal;
  dineroVendedorDistribuido: Decimal;
  modeloNegocio: ModeloNegocio;
}

/**
 * Deudas pendientes del vendedor
 */
export interface DeudasPendientes {
  cuadresPendientes: Decimal;
  equipamientoPendiente: Decimal;
  total: Decimal;
}

/**
 * Resultado de la distribución de dinero
 */
export interface DistribucionDinero {
  deudasSaldadas: Decimal;
  inversionAdminLotesExistentes: Decimal;
  inversionAdminLoteForzado: Decimal;
  inversionVendedorLotesExistentes: Decimal;
  inversionVendedorLoteForzado: Decimal;
  gananciasAdmin: Decimal;
  gananciasVendedor: Decimal;
  gananciasReclutadores: GananciaReclutadorMayor[];
  montoTotalAdmin: Decimal;
  montoTotalVendedor: Decimal;
}

/**
 * Datos para crear evaluación financiera
 */
export interface DatosEvaluacionFinanciera {
  ingresoBrutoMayor: Decimal;
  dineroRecaudadoDetal: Decimal;
  lotesExistentes: LoteParaEvaluacion[];
  loteForzado: LoteParaEvaluacion | null;
  deudas: DeudasPendientes;
  modeloNegocio: ModeloNegocio;
  jerarquiaReclutadores: JerarquiaReclutador[];
}

/**
 * Domain Service: Evaluador Financiero para Cuadre al Mayor
 * Según secciones 7.5, 7.6 y 8.10 del documento
 *
 * Orden estricto de asignación del dinero total disponible:
 * 1. Saldar deudas pendientes → Admin
 * 2. Cubrir inversión admin de lotes existentes → Admin
 * 3. Cubrir inversión admin de lote forzado → Admin
 * 4. Cubrir inversión vendedor de lotes existentes → Vendedor
 * 5. Cubrir inversión vendedor de lote forzado → Vendedor
 * 6. Ganancias según modelo (60/40 o 50/50 con cascada)
 */
@Injectable()
export class EvaluadorFinancieroMayorService {
  constructor(private readonly calculadoraGanancias: CalculadoraGananciasService) {}

  /**
   * Genera la evaluación financiera completa
   * Según sección 8.3
   */
  generarEvaluacionFinanciera(datos: DatosEvaluacionFinanciera): EvaluacionFinanciera {
    const dineroTotalDisponible = datos.ingresoBrutoMayor.plus(datos.dineroRecaudadoDetal);

    // Calcular inversiones totales
    let inversionAdminTotal = new Decimal(0);
    let inversionVendedorTotal = new Decimal(0);

    for (const lote of datos.lotesExistentes) {
      inversionAdminTotal = inversionAdminTotal.plus(lote.inversionAdmin);
      inversionVendedorTotal = inversionVendedorTotal.plus(lote.inversionVendedor);
    }

    if (datos.loteForzado) {
      inversionAdminTotal = inversionAdminTotal.plus(datos.loteForzado.inversionAdmin);
      inversionVendedorTotal = inversionVendedorTotal.plus(datos.loteForzado.inversionVendedor);
    }

    const inversionTotal = inversionAdminTotal.plus(inversionVendedorTotal);

    // Calcular ganancia neta
    let gananciaNeta = dineroTotalDisponible.minus(datos.deudas.total).minus(inversionTotal);

    if (gananciaNeta.lessThan(0)) {
      gananciaNeta = new Decimal(0);
    }

    // Calcular ganancias según modelo
    const resultadoGanancias = this.calculadoraGanancias.calcularGanancias(
      gananciaNeta.plus(inversionTotal), // dineroRecaudado = gananciaNeta + inversiones
      inversionTotal,
      datos.modeloNegocio,
      datos.jerarquiaReclutadores,
    );

    const gananciasReclutadores: GananciaReclutadorMayor[] =
      resultadoGanancias.gananciasReclutadores.map((g) => ({
        reclutadorId: g.reclutadorId,
        nivel: g.nivel,
        monto: g.monto,
      }));

    return {
      dineroRecaudadoDetal: datos.dineroRecaudadoDetal,
      dineroVentaMayor: datos.ingresoBrutoMayor,
      dineroTotalDisponible,
      inversionAdminTotal,
      inversionVendedorTotal,
      inversionAdminCubierta: inversionAdminTotal, // Se asume cubierto si hay dinero suficiente
      inversionVendedorCubierta: inversionVendedorTotal,
      gananciaNeta,
      gananciaAdmin: resultadoGanancias.gananciaAdmin,
      gananciaVendedor: resultadoGanancias.gananciaVendedor,
      deudasSaldadas: datos.deudas.total,
      gananciasReclutadores,
    };
  }

  /**
   * Calcula la distribución de dinero según orden estricto
   * Según sección 7.5 y 16.8
   */
  calcularDistribucion(datos: DatosEvaluacionFinanciera): DistribucionDinero {
    let dineroDisponible = datos.ingresoBrutoMayor.plus(datos.dineroRecaudadoDetal);

    // 1. Saldar deudas pendientes → Admin
    const deudasSaldadas = Decimal.min(dineroDisponible, datos.deudas.total);
    dineroDisponible = dineroDisponible.minus(deudasSaldadas);

    // 2. Cubrir inversión admin de lotes existentes → Admin
    let inversionAdminExistentes = new Decimal(0);
    for (const lote of datos.lotesExistentes) {
      // Solo cubrir lo que no se ha transferido aún
      const inversionPendiente = lote.inversionAdmin.minus(lote.dineroTransferido);
      if (inversionPendiente.greaterThan(0)) {
        const cubierto = Decimal.min(dineroDisponible, inversionPendiente);
        inversionAdminExistentes = inversionAdminExistentes.plus(cubierto);
        dineroDisponible = dineroDisponible.minus(cubierto);
      }
    }

    // 3. Cubrir inversión admin de lote forzado → Admin
    let inversionAdminForzado = new Decimal(0);
    if (datos.loteForzado) {
      const cubierto = Decimal.min(dineroDisponible, datos.loteForzado.inversionAdmin);
      inversionAdminForzado = cubierto;
      dineroDisponible = dineroDisponible.minus(cubierto);
    }

    // 4. Cubrir inversión vendedor de lotes existentes → Vendedor
    // Solo cubrir la inversión que aún no fue cubierta en cuadres-mayor anteriores.
    // dineroVendedorDistribuido rastrea exactamente cuánto se ha entregado al vendedor.
    let inversionVendedorExistentes = new Decimal(0);
    for (const lote of datos.lotesExistentes) {
      const inversionPendiente = lote.inversionVendedor.minus(lote.dineroVendedorDistribuido);
      if (inversionPendiente.greaterThan(0)) {
        const cubierto = Decimal.min(dineroDisponible, inversionPendiente);
        inversionVendedorExistentes = inversionVendedorExistentes.plus(cubierto);
        dineroDisponible = dineroDisponible.minus(cubierto);
      }
    }

    // 5. Cubrir inversión vendedor de lote forzado → Vendedor
    let inversionVendedorForzado = new Decimal(0);
    if (datos.loteForzado) {
      const cubierto = Decimal.min(dineroDisponible, datos.loteForzado.inversionVendedor);
      inversionVendedorForzado = cubierto;
      dineroDisponible = dineroDisponible.minus(cubierto);
    }

    // 6. Ganancias restantes → Se reparten según el modelo
    const gananciaNeta = dineroDisponible;
    let gananciasAdmin = new Decimal(0);
    let gananciasVendedor = new Decimal(0);
    let gananciasReclutadores: GananciaReclutadorMayor[] = [];

    if (gananciaNeta.greaterThan(0)) {
      const inversionTotal = inversionAdminExistentes
        .plus(inversionAdminForzado)
        .plus(inversionVendedorExistentes)
        .plus(inversionVendedorForzado);

      const resultadoGanancias = this.calculadoraGanancias.calcularGanancias(
        gananciaNeta.plus(inversionTotal),
        inversionTotal,
        datos.modeloNegocio,
        datos.jerarquiaReclutadores,
      );

      gananciasAdmin = resultadoGanancias.gananciaAdmin;
      gananciasVendedor = resultadoGanancias.gananciaVendedor;
      gananciasReclutadores = resultadoGanancias.gananciasReclutadores.map((g) => ({
        reclutadorId: g.reclutadorId,
        nivel: g.nivel,
        monto: g.monto,
      }));
    }

    // Calcular totales
    const montoTotalAdmin = deudasSaldadas
      .plus(inversionAdminExistentes)
      .plus(inversionAdminForzado)
      .plus(gananciasAdmin);

    const montoTotalVendedor = inversionVendedorExistentes
      .plus(inversionVendedorForzado)
      .plus(gananciasVendedor);

    return {
      deudasSaldadas,
      inversionAdminLotesExistentes: inversionAdminExistentes,
      inversionAdminLoteForzado: inversionAdminForzado,
      inversionVendedorLotesExistentes: inversionVendedorExistentes,
      inversionVendedorLoteForzado: inversionVendedorForzado,
      gananciasAdmin,
      gananciasVendedor,
      gananciasReclutadores,
      montoTotalAdmin,
      montoTotalVendedor,
    };
  }
}
