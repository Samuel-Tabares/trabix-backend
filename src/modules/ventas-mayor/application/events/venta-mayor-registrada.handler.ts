import { EventsHandler, IEventHandler, QueryBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { VentaMayorRegistradaEvent } from './venta-mayor-registrada.event';
import {
  ICuadreMayorRepository,
  CUADRE_MAYOR_REPOSITORY,
} from '../../../cuadres-mayor/domain/cuadre-mayor.repository.interface';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../../cuadres/domain/cuadre.repository.interface';
import { EvaluadorFinancieroMayorService } from '../../../cuadres-mayor/domain/evaluador-financiero-mayor.service';
import { CalculadoraInversionService } from '../../../lotes/domain/calculadora-inversion.service';
import { JerarquiaReclutador } from '../../../cuadres/domain/calculadora-ganancias.service';
import { TandaAfectada } from '../../../cuadres-mayor/domain/cuadre-mayor.entity';
import { ObtenerDeudaEquipamientoQuery } from '../../../equipamiento/application/queries';

/**
 * Handler del evento VentaMayorRegistrada
 *
 * Genera el cuadre al mayor con:
 * - Evaluación financiera completa
 * - Distribución de dinero
 * - Lote forzado si es necesario
 * - Cálculo de deudas pendientes (cuadres + equipamiento)
 */
@EventsHandler(VentaMayorRegistradaEvent)
export class VentaMayorRegistradaHandler implements IEventHandler<VentaMayorRegistradaEvent> {
  private readonly logger = new Logger(VentaMayorRegistradaHandler.name);

  constructor(
    @Inject(CUADRE_MAYOR_REPOSITORY)
    private readonly cuadreMayorRepository: ICuadreMayorRepository,
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly queryBus: QueryBus,
    private readonly evaluadorFinanciero: EvaluadorFinancieroMayorService,
    private readonly calculadoraInversion: CalculadoraInversionService,
  ) {}

  async handle(event: VentaMayorRegistradaEvent): Promise<void> {
    this.logger.log(
      `Procesando VentaMayorRegistradaEvent: ${event.ventaMayorId} - ` +
        `${event.cantidadUnidades} unidades - $${event.ingresoBruto.toFixed(2)}`,
    );

    try {
      // Obtener la venta al mayor
      const ventaMayor = await this.ventaMayorRepository.findById(event.ventaMayorId);
      if (!ventaMayor) {
        throw new Error(`Venta al mayor no encontrada: ${event.ventaMayorId}`);
      }

      // Obtener vendedor para modelo de negocio y jerarquía
      const vendedor = await this.usuarioRepository.findById(event.vendedorId);
      if (!vendedor) {
        throw new Error(`Vendedor no encontrado: ${event.vendedorId}`);
      }

      // Obtener lotes involucrados
      const lotesInvolucrados = await Promise.all(
        event.lotesInvolucradosIds.map((id) => this.loteRepository.findById(id)),
      );

      // Construir mapa de tandaId -> { loteId, numeroTanda }
      // para enriquecer las tandasAfectadas con la información completa
      const tandaInfoMap = new Map<string, { loteId: string; numeroTanda: number }>();
      for (const lote of lotesInvolucrados) {
        if (!lote?.tandas) continue;
        for (const tanda of lote.tandas) {
          tandaInfoMap.set(tanda.id, {
            loteId: lote.id,
            numeroTanda: tanda.numero,
          });
        }
      }

      // Calcular dinero recaudado al detal (de todos los lotes involucrados)
      let dineroRecaudadoDetal = new Decimal(0);
      const lotesParaEvaluacion = [];

      for (const lote of lotesInvolucrados) {
        if (!lote) continue;

        // Dinero pendiente de distribución = total recaudado − ya dado al admin − ya dado al vendedor
        dineroRecaudadoDetal = dineroRecaudadoDetal.plus(
          new Decimal(lote.dineroRecaudado)
            .minus(lote.dineroTransferido)
            .minus(lote.dineroVendedorDistribuido),
        );

        lotesParaEvaluacion.push({
          id: lote.id,
          inversionAdmin: new Decimal(lote.inversionAdmin),
          inversionVendedor: new Decimal(lote.inversionVendedor),
          dineroRecaudado: new Decimal(lote.dineroRecaudado),
          dineroTransferido: new Decimal(lote.dineroTransferido),
          dineroVendedorDistribuido: new Decimal(lote.dineroVendedorDistribuido),
          modeloNegocio: lote.modeloNegocio,
        });
      }

      // Crear lote forzado si es necesario
      let loteForzado = null;
      let loteForzadoId: string | undefined;

      if (event.necesitaLoteForzado && event.cantidadLoteForzado > 0) {
        // Calcular inversiones del lote forzado
        const inversionesLoteForzado = this.calculadoraInversion.calcularInversiones(
          event.cantidadLoteForzado,
        );

        // Crear lote forzado (se activará y finalizará al confirmar el cuadre)
        const nuevoLoteForzado = await this.loteRepository.create({
          tandas: [],
          vendedorId: event.vendedorId,
          cantidadTrabix: event.cantidadLoteForzado,
          inversionAdmin: inversionesLoteForzado.inversionAdmin,
          inversionVendedor: inversionesLoteForzado.inversionVendedor,
          inversionTotal: inversionesLoteForzado.inversionTotal,
          modeloNegocio: (vendedor as any).modeloNegocio,
        });

        loteForzadoId = nuevoLoteForzado.id;
        loteForzado = {
          id: nuevoLoteForzado.id,
          inversionAdmin: inversionesLoteForzado.inversionAdmin,
          inversionVendedor: inversionesLoteForzado.inversionVendedor,
          dineroRecaudado: new Decimal(0),
          dineroTransferido: new Decimal(0),
          dineroVendedorDistribuido: new Decimal(0),
          modeloNegocio: (vendedor as any).modeloNegocio,
        };

        this.logger.log(
          `Lote forzado creado: ${loteForzadoId} - ${event.cantidadLoteForzado} TRABIX`,
        );
      }

      // Obtener jerarquía de reclutadores (para modelo 50/50)
      const jerarquia = await this.obtenerJerarquiaReclutadores(event.vendedorId);

      // Calcular deudas pendientes del vendedor
      const deudas = await this.calcularDeudasPendientes(event.vendedorId);

      this.logger.log(
        `Deudas calculadas para vendedor ${event.vendedorId}: ` +
          `Cuadres: $${deudas.cuadresPendientes.toFixed(2)} - ` +
          `Equipamiento: $${deudas.equipamientoPendiente.toFixed(2)} - ` +
          `Total: $${deudas.total.toFixed(2)}`,
      );

      // Calcular distribución de dinero
      const distribucion = this.evaluadorFinanciero.calcularDistribucion({
        ingresoBrutoMayor: event.ingresoBruto,
        dineroRecaudadoDetal,
        lotesExistentes: lotesParaEvaluacion,
        loteForzado,
        deudas,
        modeloNegocio: (vendedor as any).modeloNegocio,
        jerarquiaReclutadores: jerarquia,
      });

      // Generar evaluación financiera
      const evaluacionFinanciera = this.evaluadorFinanciero.generarEvaluacionFinanciera({
        ingresoBrutoMayor: event.ingresoBruto,
        dineroRecaudadoDetal,
        lotesExistentes: lotesParaEvaluacion,
        loteForzado,
        deudas,
        modeloNegocio: (vendedor as any).modeloNegocio,
        jerarquiaReclutadores: jerarquia,
      });

      // Preparar tandas afectadas con información completa
      const tandasAfectadas: TandaAfectada[] = (ventaMayor.fuentesStock || [])
        .map((f) => {
          const tandaInfo = tandaInfoMap.get(f.tandaId);
          return {
            tandaId: f.tandaId,
            cantidadStockConsumido: f.cantidadConsumida,
            numeroTanda: tandaInfo?.numeroTanda ?? 0,
            loteId: tandaInfo?.loteId ?? '',
          };
        })
        .filter((t) => t.loteId !== ''); // Filtrar tandas sin lote (no debería pasar)

      // Crear el cuadre al mayor
      const cuadreMayor = await this.cuadreMayorRepository.create({
        ventaMayorId: event.ventaMayorId,
        vendedorId: event.vendedorId,
        modalidad: event.modalidad,
        cantidadUnidades: event.cantidadUnidades,
        precioUnidad: new Decimal(ventaMayor.precioUnidad),
        ingresoBruto: event.ingresoBruto,
        deudasSaldadas: distribucion.deudasSaldadas,
        inversionAdminLotesExistentes: distribucion.inversionAdminLotesExistentes,
        inversionAdminLoteForzado: distribucion.inversionAdminLoteForzado,
        inversionVendedorLotesExistentes: distribucion.inversionVendedorLotesExistentes,
        inversionVendedorLoteForzado: distribucion.inversionVendedorLoteForzado,
        gananciasAdmin: distribucion.gananciasAdmin,
        gananciasVendedor: distribucion.gananciasVendedor,
        evaluacionFinanciera,
        montoTotalAdmin: distribucion.montoTotalAdmin,
        montoTotalVendedor: distribucion.montoTotalVendedor,
        lotesInvolucradosIds: event.lotesInvolucradosIds,
        tandasAfectadas,
        loteForzadoId,
        gananciasReclutadores: distribucion.gananciasReclutadores,
      });

      this.logger.log(
        `Cuadre al mayor creado: ${cuadreMayor.id} - ` +
          `Admin: $${distribucion.montoTotalAdmin.toFixed(2)} - ` +
          `Vendedor: $${distribucion.montoTotalVendedor.toFixed(2)}`,
      );
    } catch (error) {
      this.logger.error(`Error procesando VentaMayorRegistradaEvent: ${event.ventaMayorId}`, error);
      throw error;
    }
  }

  /**
   * Calcula las deudas pendientes del vendedor
   * Incluye: cuadres pendientes + deuda de equipamiento
   */
  private async calcularDeudasPendientes(vendedorId: string): Promise<{
    cuadresPendientes: Decimal;
    equipamientoPendiente: Decimal;
    total: Decimal;
  }> {
    // 1. Calcular monto de cuadres pendientes
    const cuadresPendientes = await this.calcularCuadresPendientes(vendedorId);

    // 2. Calcular deuda de equipamiento
    const equipamientoPendiente = await this.calcularDeudaEquipamiento(vendedorId);

    // 3. Calcular total
    const total = cuadresPendientes.plus(equipamientoPendiente);

    return {
      cuadresPendientes,
      equipamientoPendiente,
      total,
    };
  }

  /**
   * Calcula el monto total de cuadres en estado PENDIENTE
   * Suma todos los montoEsperado de cuadres PENDIENTE del vendedor
   */
  private async calcularCuadresPendientes(vendedorId: string): Promise<Decimal> {
    try {
      const resultado = await this.cuadreRepository.findByVendedorId(vendedorId, {
        where: { estado: 'PENDIENTE' },
        take: 100, // Máximo razonable de cuadres pendientes
      });

      let totalPendiente = new Decimal(0);

      for (const cuadre of resultado.data) {
        // Sumar montoEsperado ajustado (menos lo ya cubierto por mayor)
        const montoEsperado = new Decimal(cuadre.montoEsperado || 0);
        const montoCubierto = new Decimal(cuadre.montoCubiertoPorMayor || 0);
        const montoPendiente = montoEsperado.minus(montoCubierto);

        if (montoPendiente.greaterThan(0)) {
          totalPendiente = totalPendiente.plus(montoPendiente);
        }
      }

      return totalPendiente;
    } catch (error) {
      this.logger.warn(`Error calculando cuadres pendientes para vendedor ${vendedorId}: ${error}`);
      return new Decimal(0);
    }
  }

  /**
   * Calcula la deuda total de equipamiento del vendedor
   * Incluye: daños + pérdida + mensualidades pendientes
   */
  private async calcularDeudaEquipamiento(vendedorId: string): Promise<Decimal> {
    try {
      const deudaEquipamiento = await this.queryBus.execute(
        new ObtenerDeudaEquipamientoQuery(vendedorId),
      );

      if (!deudaEquipamiento) {
        return new Decimal(0);
      }

      // deudaTotalParaCuadre ya incluye: daños + pérdida + mensualidades
      return new Decimal(deudaEquipamiento.deudaTotalParaCuadre);
    } catch (error) {
      this.logger.warn(`Error calculando deuda equipamiento para vendedor ${vendedorId}: ${error}`);
      return new Decimal(0);
    }
  }

  /**
   * Obtiene la jerarquía de reclutadores del vendedor
   * Para el modelo 50/50 con cascada
   */
  private async obtenerJerarquiaReclutadores(vendedorId: string): Promise<JerarquiaReclutador[]> {
    const jerarquia: JerarquiaReclutador[] = [];
    let nivel = 1;
    let usuarioActual = await this.usuarioRepository.findById(vendedorId);

    // Subir por la cadena de reclutadores
    while (usuarioActual?.reclutadorId && nivel <= 10) {
      const reclutador = await this.usuarioRepository.findById(usuarioActual.reclutadorId);

      if (reclutador && reclutador.rol !== 'ADMIN') {
        jerarquia.push({
          id: reclutador.id,
          nivel,
          nombre: `${reclutador.nombre} ${reclutador.apellidos}`,
        });
        nivel++;
        usuarioActual = reclutador;
      } else {
        break;
      }
    }

    return jerarquia;
  }
}
