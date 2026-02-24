import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { ModeloNegocio, ConceptoCuadre } from '@prisma/client';
import { CalculadoraGananciasService, JerarquiaReclutador } from './calculadora-ganancias.service';
import { ObtenerDeudaEquipamientoQuery } from '../../equipamiento/application/queries';
import { DesgloseCuadre } from './cuadre.repository.interface';

/**
 * Servicio de dominio para calcular el monto esperado de un cuadre
 * Integra: inversión admin + ganancias + deudas de equipamiento
 *
 * Según sección 8 del documento:
 * monto_esperado = inversion_admin + ganancias_admin + deuda_equipamiento
 *
 * Donde deuda_equipamiento incluye:
 * - Mensualidades pendientes
 * - Deudas por daños
 * - Deudas por pérdida
 */
@Injectable()
export class CalculadoraMontoEsperadoService {
  constructor(
    private readonly calculadoraGanancias: CalculadoraGananciasService,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Calcula el monto esperado inicial al crear un cuadre
   * Se usa en lote-activado.handler.ts
   */
  async calcularMontoEsperadoInicial(params: {
    vendedorId: string;
    numeroTanda: number;
    totalTandas: number;
    inversionAdmin: Decimal;
    concepto: ConceptoCuadre;
  }): Promise<MontoEsperadoResult> {
    const { vendedorId, numeroTanda, inversionAdmin, concepto } = params;

    // Base del monto según el concepto
    let montoBase = new Decimal(0);

    if (concepto === 'INVERSION_ADMIN' || concepto === 'MIXTO') {
      // T1 en lotes de 3 tandas: solo inversión admin
      montoBase = inversionAdmin;
    }
    // Para GANANCIAS (T2, T3): el monto base es 0, se actualiza con ventas

    // Obtener deudas de equipamiento
    const deudaEquipamiento = await this.obtenerDeudaEquipamiento(vendedorId);

    // Solo agregar deuda de equipamiento en la primera tanda
    // para no duplicar la deuda en cada cuadre
    const incluirDeudaEquipamiento = numeroTanda === 1;

    const montoTotal = incluirDeudaEquipamiento
      ? montoBase.plus(deudaEquipamiento.total)
      : montoBase;

    const desglose: DesgloseCuadre = {
      inversionAdmin:
        concepto === 'INVERSION_ADMIN' || concepto === 'MIXTO' ? inversionAdmin.toNumber() : 0,
      gananciasAdmin: 0,
      mensualidades: incluirDeudaEquipamiento
        ? deudaEquipamiento.montoMensualidades.toNumber()
        : 0,
      deudaDano: incluirDeudaEquipamiento ? deudaEquipamiento.deudaDano.toNumber() : 0,
      deudaPerdida: incluirDeudaEquipamiento ? deudaEquipamiento.deudaPerdida.toNumber() : 0,
    };

    return {
      montoBase,
      deudaEquipamiento: incluirDeudaEquipamiento ? deudaEquipamiento : null,
      montoTotal,
      desglose,
    };
  }

  /**
   * Calcula el monto esperado actualizado cuando se aprueba una venta
   * Incluye ganancias calculadas + deudas de equipamiento actuales
   */
  async calcularMontoEsperadoActualizado(params: {
    vendedorId: string;
    dineroRecaudado: Decimal;
    inversionTotal: Decimal;
    inversionAdmin: Decimal;
    modeloNegocio: ModeloNegocio;
    concepto: ConceptoCuadre;
    jerarquia?: JerarquiaReclutador[];
    /**
     * Suma de gananciasAdmin ya cobradas en cuadres EXITOSOS anteriores del mismo lote.
     * Se resta para evitar duplicar ganancias entre cuadres consecutivos.
     */
    gananciasYaPagadas?: Decimal;
  }): Promise<MontoEsperadoResult> {
    const {
      vendedorId,
      dineroRecaudado,
      inversionTotal,
      inversionAdmin,
      modeloNegocio,
      concepto,
      jerarquia,
      gananciasYaPagadas = new Decimal(0),
    } = params;

    let montoBase = new Decimal(0);
    let gananciasAdmin = new Decimal(0);

    // Calcular ganancias si aplica
    if (concepto === 'GANANCIAS' || concepto === 'MIXTO') {
      const resultadoGanancias = this.calculadoraGanancias.calcularGanancias(
        dineroRecaudado,
        inversionTotal,
        modeloNegocio,
        jerarquia,
      );

      if (resultadoGanancias.hayGanancias) {
        // Descontar lo ya cobrado en cuadres anteriores del mismo lote
        const gananciasNetas = resultadoGanancias.gananciaAdmin.minus(gananciasYaPagadas);
        gananciasAdmin = Decimal.max(new Decimal(0), gananciasNetas);
        montoBase = gananciasAdmin;
      }
    }

    // Si es MIXTO o INVERSION_ADMIN, agregar inversión admin
    if (concepto === 'MIXTO' || concepto === 'INVERSION_ADMIN') {
      montoBase = montoBase.plus(inversionAdmin);
    }

    // Obtener deudas de equipamiento actuales
    const deudaEquipamiento = await this.obtenerDeudaEquipamiento(vendedorId);

    const montoTotal = montoBase.plus(deudaEquipamiento.total);

    const desglose: DesgloseCuadre = {
      inversionAdmin:
        concepto === 'MIXTO' || concepto === 'INVERSION_ADMIN' ? inversionAdmin.toNumber() : 0,
      gananciasAdmin: gananciasAdmin.toNumber(),
      mensualidades: deudaEquipamiento.montoMensualidades.toNumber(),
      deudaDano: deudaEquipamiento.deudaDano.toNumber(),
      deudaPerdida: deudaEquipamiento.deudaPerdida.toNumber(),
    };

    return {
      montoBase,
      deudaEquipamiento,
      montoTotal,
      desglose,
    };
  }

  /**
   * Obtiene las deudas de equipamiento del vendedor
   */
  async obtenerDeudaEquipamiento(vendedorId: string): Promise<DeudaEquipamientoDetalle> {
    try {
      const deuda = await this.queryBus.execute(new ObtenerDeudaEquipamientoQuery(vendedorId));

      if (!deuda) {
        return {
          equipamientoId: null,
          deudaDano: new Decimal(0),
          deudaPerdida: new Decimal(0),
          mensualidadesPendientes: 0,
          montoMensualidades: new Decimal(0),
          total: new Decimal(0),
        };
      }

      return {
        equipamientoId: deuda.equipamientoId,
        deudaDano: new Decimal(deuda.deudaDano),
        deudaPerdida: new Decimal(deuda.deudaPerdida),
        mensualidadesPendientes: deuda.mensualidadesPendientes,
        montoMensualidades: new Decimal(deuda.montoMensualidadesPendientes),
        total: new Decimal(deuda.deudaTotalParaCuadre),
      };
    } catch (error) {
      // Si hay error al obtener deuda, retornar 0 para no bloquear el flujo
      return {
        equipamientoId: null,
        deudaDano: new Decimal(0),
        deudaPerdida: new Decimal(0),
        mensualidadesPendientes: 0,
        montoMensualidades: new Decimal(0),
        total: new Decimal(0),
      };
    }
  }
}

/**
 * Resultado del cálculo de monto esperado
 */
export interface MontoEsperadoResult {
  montoBase: Decimal;
  deudaEquipamiento: DeudaEquipamientoDetalle | null;
  montoTotal: Decimal;
  desglose: DesgloseCuadre;
}

/**
 * Detalle de deuda de equipamiento
 */
export interface DeudaEquipamientoDetalle {
  equipamientoId: string | null;
  deudaDano: Decimal;
  deudaPerdida: Decimal;
  mensualidadesPendientes: number;
  montoMensualidades: Decimal;
  total: Decimal;
}
