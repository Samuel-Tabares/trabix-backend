import { Injectable, Logger, Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ModeloNegocio } from '@prisma/client';
import { ICuadreRepository, CUADRE_REPOSITORY } from './cuadre.repository.interface';
import { CalculadoraMontoEsperadoService } from './calculadora-monto-esperado.service';

/**
 * Resultado de la actualización
 */
export interface ResultadoActualizacion {
  cuadreId: string | null;
  montoAnterior: Decimal | 0;
  montoNuevo: Decimal | 0;
  diferencia: Decimal | 0;
  actualizado: boolean;
  motivo: string;
}

/**
 * Domain Service: Actualizador de Cuadres por Vendedor
 *
 * REGLA DE NEGOCIO:
 * - Pueden existir múltiples cuadres INACTIVO (hasta 7, uno por lote)
 * - Solo puede existir 1 cuadre PENDIENTE (el activo en flujo)
 * - La deuda de equipamiento va en el cuadre PENDIENTE
 * - Si no hay PENDIENTE, va en el INACTIVO más antiguo (próximo a activarse)
 *
 * NUNCA modifica cuadres EXITOSO o cerrados por cuadre-mayor.
 */
@Injectable()
export class ActualizadorCuadresVendedorService {
  private readonly logger = new Logger(ActualizadorCuadresVendedorService.name);

  constructor(
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly calculadoraMontoEsperado: CalculadoraMontoEsperadoService,
  ) {}

  /**
   * Actualiza el cuadre activo cuando cambia la deuda de equipamiento
   */
  async actualizarPorCambioDeudaEquipamiento(
    vendedorId: string,
    motivo: string,
  ): Promise<ResultadoActualizacion> {
    this.logger.log(
      `Actualizando cuadre por deuda equipamiento. Vendedor: ${vendedorId}. Motivo: ${motivo}`,
    );

    try {
      // Buscar el cuadre a actualizar (PENDIENTE o INACTIVO más antiguo)
      const cuadre = await this.obtenerCuadreParaActualizar(vendedorId);

      if (!cuadre) {
        this.logger.log(`Vendedor ${vendedorId} no tiene cuadre para actualizar`);
        return this.sinCambios('No hay cuadre PENDIENTE ni INACTIVO');
      }

      return await this.recalcularYActualizar(cuadre, motivo);
    } catch (error) {
      this.logger.error(`Error actualizando cuadre: ${error}`);
      throw error;
    }
  }

  /**
   * Actualiza el cuadre cuando se aprueba una venta
   */
  async actualizarPorVentaAprobada(cuadreId: string): Promise<ResultadoActualizacion> {
    this.logger.log(`Actualizando cuadre ${cuadreId} por venta aprobada`);

    try {
      const cuadre = await this.cuadreRepository.findById(cuadreId);

      if (!cuadre || cuadre.estado === 'EXITOSO' || cuadre.cerradoPorCuadreMayorId) {
        return this.sinCambios('Cuadre no elegible');
      }

      return await this.recalcularYActualizar(cuadre, 'Venta aprobada');
    } catch (error) {
      this.logger.error(`Error actualizando por venta: ${error}`);
      throw error;
    }
  }

  /**
   * Obtiene el cuadre a actualizar según prioridad:
   * 1. PENDIENTE (el activo en flujo) - solo puede haber 1
   * 2. INACTIVO más antiguo (el próximo a activarse)
   */
  private async obtenerCuadreParaActualizar(vendedorId: string): Promise<any | null> {
    const resultado = await this.cuadreRepository.findByVendedorId(vendedorId, {
      take: 50,
    });

    // Filtrar: no EXITOSO, no cerrado por mayor
    const elegibles = resultado.data.filter(
      (c) => c.estado !== 'EXITOSO' && !c.cerradoPorCuadreMayorId,
    );

    if (elegibles.length === 0) return null;

    // Prioridad 1: Buscar el PENDIENTE (solo puede haber 1)
    const pendiente = elegibles.find((c) => c.estado === 'PENDIENTE');
    if (pendiente) {
      this.logger.debug(`Cuadre PENDIENTE encontrado: ${pendiente.id}`);
      return pendiente;
    }

    // Ordenar por número de tanda (T1 antes que T2, T2 antes que T3)
    const inactivos = elegibles
      .filter((c) => c.estado === 'INACTIVO')
      .sort((a, b) => (a.tanda?.numero || 0) - (b.tanda?.numero || 0));
    if (inactivos.length > 0) {
      this.logger.debug(`Cuadre INACTIVO más antiguo: ${inactivos[0].id}`);
      return inactivos[0];
    }

    return null;
  }

  /**
   * Recalcula el montoEsperado y actualiza si hay diferencia
   */
  private async recalcularYActualizar(
    cuadre: any,
    motivo: string,
  ): Promise<ResultadoActualizacion> {
    const lote = cuadre.tanda?.lote;
    if (!lote) {
      return this.sinCambios('Lote no encontrado');
    }

    const montoAnterior = new Decimal(cuadre.montoEsperado);

    // Sumar gananciasAdmin ya cobradas en cuadres EXITOSOS anteriores del mismo lote
    // para no volver a incluirlas en el cuadre actual (evita duplicación entre tandas)
    const cuadresDelLote = await this.cuadreRepository.findByLoteId(lote.id);
    const gananciasYaPagadas = cuadresDelLote
      .filter((c) => c.estado === 'EXITOSO' && c.id !== cuadre.id)
      .reduce((suma, c) => {
        const desglose = c.desglose as { gananciasAdmin?: number } | null;
        return suma.plus(new Decimal(desglose?.gananciasAdmin ?? 0));
      }, new Decimal(0));

    // Calcular nuevo monto (incluye ganancias netas + deuda equipamiento)
    const nuevoCalculo = await this.calculadoraMontoEsperado.calcularMontoEsperadoActualizado({
      vendedorId: lote.vendedorId,
      dineroRecaudado: new Decimal(lote.dineroRecaudado),
      inversionTotal: new Decimal(lote.inversionTotal),
      inversionAdmin: new Decimal(lote.inversionAdmin),
      modeloNegocio: lote.modeloNegocio as ModeloNegocio,
      concepto: cuadre.concepto,
      jerarquia: [],
      gananciasYaPagadas,
    });

    const montoNuevo = nuevoCalculo.montoTotal;
    const diferencia = montoNuevo.minus(montoAnterior);

    // Solo actualizar si hay diferencia significativa (> $1)
    if (diferencia.abs().lessThanOrEqualTo(1)) {
      return {
        cuadreId: cuadre.id,
        montoAnterior,
        montoNuevo,
        diferencia,
        actualizado: false,
        motivo: 'Sin cambios significativos',
      };
    }

    // Actualizar en BD
    await this.cuadreRepository.actualizarMontoEsperado(cuadre.id, montoNuevo, nuevoCalculo.desglose);

    this.logger.log(
      `Cuadre ${cuadre.id} (${cuadre.estado}) actualizado: ` +
        `$${montoAnterior.toFixed(0)} → $${montoNuevo.toFixed(0)} ` +
        `(${diferencia.greaterThan(0) ? '+' : ''}$${diferencia.toFixed(0)}) - ${motivo}`,
    );

    return {
      cuadreId: cuadre.id,
      montoAnterior,
      montoNuevo,
      diferencia,
      actualizado: true,
      motivo,
    };
  }

  private sinCambios(motivo: string): ResultadoActualizacion {
    return {
      cuadreId: null,
      montoAnterior: 0,
      montoNuevo: 0,
      diferencia: 0,
      actualizado: false,
      motivo,
    };
  }
}
