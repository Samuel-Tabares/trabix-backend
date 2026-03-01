import { CommandHandler, ICommandHandler, ICommand, QueryBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ModalidadVentaMayor } from '@prisma/client';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import {
  ICuadreMayorRepository,
  CUADRE_MAYOR_REPOSITORY,
} from '../../../cuadres-mayor/domain/cuadre-mayor.repository.interface';
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
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para confirmar una venta al mayor
 * Crea el CuadreMayor con datos frescos y marca la venta como COMPLETADA
 */
export class ConfirmarVentaMayorCommand implements ICommand {
  constructor(
    public readonly ventaMayorId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ConfirmarVentaMayor
 *
 * Pasos:
 * 1. Validar VentaMayor existe y está PENDIENTE
 * 2. Validar vendedor ACTIVO
 * 3. Fetch lotes frescos (con inversionAdmin, dineroTransferido, etc.)
 * 4. Crear lote forzado si necesitaLoteForzado (con tandas: [])
 * 5. Calcular dineroRecaudadoDetal (dineroRecaudado - dineroTransferido - dineroVendedorDistribuido)
 * 6. Calcular deudas pendientes (cuadres PENDIENTE + equipamiento)
 * 7. Obtener jerarquía reclutadores (si modelo 50/50)
 * 8. Calcular distribución financiera
 * 9. Crear CuadreMayor (estado PENDIENTE)
 * 10. Marcar VentaMayor como COMPLETADA
 */
@CommandHandler(ConfirmarVentaMayorCommand)
export class ConfirmarVentaMayorHandler implements ICommandHandler<ConfirmarVentaMayorCommand> {
  private readonly logger = new Logger(ConfirmarVentaMayorHandler.name);

  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
    @Inject(CUADRE_MAYOR_REPOSITORY)
    private readonly cuadreMayorRepository: ICuadreMayorRepository,
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

  async execute(command: ConfirmarVentaMayorCommand): Promise<unknown> {
    const { ventaMayorId } = command;

    // 1. Validar VentaMayor existe y está PENDIENTE
    const ventaMayor = await this.ventaMayorRepository.findById(ventaMayorId);
    if (!ventaMayor) {
      throw new DomainException('VMA_005', 'Venta al mayor no encontrada', { ventaMayorId });
    }
    if (ventaMayor.estado !== 'PENDIENTE') {
      throw new DomainException('VMA_006', 'Solo se pueden confirmar ventas en estado PENDIENTE', {
        estadoActual: ventaMayor.estado,
      });
    }

    // 2. Validar vendedor ACTIVO
    const vendedor = await this.usuarioRepository.findById(ventaMayor.vendedorId);
    if (!vendedor) {
      throw new DomainException('VMA_003', 'Vendedor no encontrado', {
        vendedorId: ventaMayor.vendedorId,
      });
    }
    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException('VMA_004', 'El vendedor no está activo', {
        estado: vendedor.estado,
      });
    }

    // 3. Obtener lotes involucrados (datos frescos)
    const lotesInvolucradosIds = (ventaMayor.lotesInvolucrados ?? []).map((l) => l.loteId);

    const lotesInvolucrados = await Promise.all(
      lotesInvolucradosIds.map((id) => this.loteRepository.findById(id)),
    );

    // Construir mapa de tandaId → { loteId, numeroTanda }
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

    // 5. Calcular dinero recaudado al detal (datos frescos)
    let dineroRecaudadoDetal = new Decimal(0);
    const lotesParaEvaluacion = [];

    for (const lote of lotesInvolucrados) {
      if (!lote) continue;

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

    // Detectar si necesita lote forzado (hay fuentesStock en la venta que indica necesidad)
    const fuentesStock = ventaMayor.fuentesStock ?? [];
    const stockDeLotesExistentes = fuentesStock.reduce((sum, f) => sum + f.cantidadConsumida, 0);
    const necesitaLoteForzado = stockDeLotesExistentes < ventaMayor.cantidadUnidades;
    const cantidadLoteForzado = ventaMayor.cantidadUnidades - stockDeLotesExistentes;

    // 4. Crear lote forzado si es necesario
    let loteForzado = null;
    let loteForzadoId: string | undefined;

    if (necesitaLoteForzado && cantidadLoteForzado > 0) {
      const inversionesLoteForzado = this.calculadoraInversion.calcularInversiones(
        cantidadLoteForzado,
      );

      const nuevoLoteForzado = await this.loteRepository.create({
        tandas: [],
        vendedorId: ventaMayor.vendedorId,
        cantidadTrabix: cantidadLoteForzado,
        inversionAdmin: inversionesLoteForzado.inversionAdmin,
        inversionVendedor: inversionesLoteForzado.inversionVendedor,
        inversionTotal: inversionesLoteForzado.inversionTotal,
        modeloNegocio: (vendedor as any).modeloNegocio,
        esLoteForzado: true,
        ventaMayorOrigenId: ventaMayorId,
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
        `Lote forzado creado: ${loteForzadoId} - ${cantidadLoteForzado} TRABIX`,
      );
    }

    // 7. Obtener jerarquía de reclutadores
    const jerarquia = await this.obtenerJerarquiaReclutadores(ventaMayor.vendedorId);

    // 6. Calcular deudas pendientes del vendedor
    const deudas = await this.calcularDeudasPendientes(ventaMayor.vendedorId);

    this.logger.log(
      `Deudas calculadas para vendedor ${ventaMayor.vendedorId}: ` +
        `Cuadres: $${deudas.cuadresPendientes.toFixed(2)} - ` +
        `Equipamiento: $${deudas.equipamientoPendiente.toFixed(2)} - ` +
        `Total: $${deudas.total.toFixed(2)}`,
    );

    const ingresoBruto = new Decimal(ventaMayor.ingresoBruto);

    // 8. Calcular distribución de dinero
    const datosDist = {
      ingresoBrutoMayor: ingresoBruto,
      dineroRecaudadoDetal,
      lotesExistentes: lotesParaEvaluacion,
      loteForzado,
      deudas,
      modeloNegocio: (vendedor as any).modeloNegocio,
      jerarquiaReclutadores: jerarquia,
    };

    const distribucion = this.evaluadorFinanciero.calcularDistribucion(datosDist);
    const evaluacionFinanciera = this.evaluadorFinanciero.generarEvaluacionFinanciera(datosDist);

    // Preparar tandas afectadas con información completa
    const tandasAfectadas: TandaAfectada[] = fuentesStock
      .map((f) => {
        const tandaInfo = tandaInfoMap.get(f.tandaId);
        return {
          tandaId: f.tandaId,
          cantidadStockConsumido: f.cantidadConsumida,
          numeroTanda: tandaInfo?.numeroTanda ?? 0,
          loteId: tandaInfo?.loteId ?? '',
        };
      })
      .filter((t) => t.loteId !== '');

    // 9. Crear CuadreMayor (estado PENDIENTE)
    const cuadreMayor = await this.cuadreMayorRepository.create({
      ventaMayorId,
      vendedorId: ventaMayor.vendedorId,
      modalidad: ventaMayor.modalidad as ModalidadVentaMayor,
      cantidadUnidades: ventaMayor.cantidadUnidades,
      precioUnidad: new Decimal(ventaMayor.precioUnidad),
      ingresoBruto,
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
      lotesInvolucradosIds,
      tandasAfectadas,
      loteForzadoId,
      gananciasReclutadores: distribucion.gananciasReclutadores,
    });

    // 10. Marcar VentaMayor como COMPLETADA
    await this.ventaMayorRepository.confirmar(ventaMayorId);

    this.logger.log(
      `Venta al mayor confirmada: ${ventaMayorId} - CuadreMayor: ${cuadreMayor.id} - ` +
        `Admin: $${distribucion.montoTotalAdmin.toFixed(2)} - ` +
        `Vendedor: $${distribucion.montoTotalVendedor.toFixed(2)}`,
    );

    return this.ventaMayorRepository.findById(ventaMayorId);
  }

  private async calcularDeudasPendientes(vendedorId: string): Promise<{
    cuadresPendientes: Decimal;
    equipamientoPendiente: Decimal;
    total: Decimal;
  }> {
    const cuadresPendientes = await this.calcularCuadresPendientes(vendedorId);
    const equipamientoPendiente = await this.calcularDeudaEquipamiento(vendedorId);
    const total = cuadresPendientes.plus(equipamientoPendiente);
    return { cuadresPendientes, equipamientoPendiente, total };
  }

  private async calcularCuadresPendientes(vendedorId: string): Promise<Decimal> {
    try {
      const resultado = await this.cuadreRepository.findByVendedorId(vendedorId, {
        where: { estado: 'PENDIENTE' },
        take: 100,
      });

      let totalPendiente = new Decimal(0);
      for (const cuadre of resultado.data) {
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

  private async calcularDeudaEquipamiento(vendedorId: string): Promise<Decimal> {
    try {
      const deudaEquipamiento = await this.queryBus.execute(
        new ObtenerDeudaEquipamientoQuery(vendedorId),
      );
      if (!deudaEquipamiento) return new Decimal(0);
      return new Decimal(deudaEquipamiento.deudaTotalParaCuadre);
    } catch (error) {
      this.logger.warn(`Error calculando deuda equipamiento para vendedor ${vendedorId}: ${error}`);
      return new Decimal(0);
    }
  }

  private async obtenerJerarquiaReclutadores(vendedorId: string): Promise<JerarquiaReclutador[]> {
    const jerarquia: JerarquiaReclutador[] = [];
    let nivel = 1;
    let usuarioActual = await this.usuarioRepository.findById(vendedorId);

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
