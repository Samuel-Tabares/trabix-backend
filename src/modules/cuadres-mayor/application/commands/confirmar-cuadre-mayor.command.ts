import { CommandHandler, ICommandHandler, ICommand, EventBus, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  ICuadreMayorRepository,
  CUADRE_MAYOR_REPOSITORY,
  ConfirmarCuadreMayorTransactionData,
  TandaParaProcesar,
  CuadreParaCerrar,
  CuadreDeudaSaldada,
  CuadreCreditoParcial,
  EquipamentoPago,
  DistribucionMontoLote,
} from '../../domain/cuadre-mayor.repository.interface';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../../cuadres/domain/cuadre.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../../../lotes/domain/tanda.repository.interface';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../../ventas-mayor/domain/venta-mayor.repository.interface';
import {
  IEquipamientoRepository,
  EQUIPAMIENTO_REPOSITORY,
} from '../../../equipamiento/domain/equipamiento.repository.interface';
import { EquipamientoEntity } from '../../../equipamiento/domain/equipamiento.entity';
import { CalculadoraInversionService } from '../../../lotes/domain/calculadora-inversion.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { CuadreMayorExitosoEvent } from '../events/cuadre-mayor-exitoso.event';
import { StockUltimaTandaAgotadoEvent } from '../../../mini-cuadres/application/events';
import { RegistrarEntradaFondoCommand } from '../../../fondo-recompensas/application/commands';
import { TandaAfectada, parseDecimalValue } from '../../domain/cuadre-mayor.entity';

/**
 * Command para confirmar un cuadre al mayor
 */
export class ConfirmarCuadreMayorCommand implements ICommand {
  constructor(
    public readonly cuadreMayorId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ConfirmarCuadreMayor
 * Según sección 8.10 del documento
 *
 * Pasos (ahora en transacción atómica):
 * 1. Validar que el cuadre está PENDIENTE
 * 2. Preparar datos para la transacción
 * 3. Ejecutar transacción atómica:
 *    - Consumir stock de las tandas afectadas
 *    - Cerrar cuadres normales de tandas COMPLETAMENTE consumidas
 *    - Si hay lote forzado: activar y finalizar inmediatamente
 *    - Actualizar dinero recaudado y transferido de lotes (PRORRATEADO)
 *    - Marcar cuadre como EXITOSO
 * 4. Emitir eventos post-transacción
 */
@CommandHandler(ConfirmarCuadreMayorCommand)
export class ConfirmarCuadreMayorHandler implements ICommandHandler<ConfirmarCuadreMayorCommand> {
  private readonly logger = new Logger(ConfirmarCuadreMayorHandler.name);

  constructor(
    @Inject(CUADRE_MAYOR_REPOSITORY)
    private readonly cuadreMayorRepository: ICuadreMayorRepository,
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly calculadoraInversion: CalculadoraInversionService,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ConfirmarCuadreMayorCommand): Promise<unknown> {
    const { cuadreMayorId } = command;

    // ========== 1. VALIDACIONES INICIALES ==========
    const cuadreMayor = await this.cuadreMayorRepository.findById(cuadreMayorId);
    if (!cuadreMayor) {
      throw new DomainException('CMA_002', 'Cuadre al mayor no encontrado', { cuadreMayorId });
    }

    if (cuadreMayor.estado !== 'PENDIENTE') {
      throw new DomainException('CMA_001', 'Solo se pueden confirmar cuadres en estado PENDIENTE', {
        estadoActual: cuadreMayor.estado,
      });
    }

    // Validar que la venta al mayor esté COMPLETADA antes de confirmar el cuadre.
    // El admin debe confirmar la venta directamente con el vendedor antes de cerrar el cuadre.
    const ventaMayor = await this.ventaMayorRepository.findById(cuadreMayor.ventaMayorId);
    if (!ventaMayor) {
      throw new DomainException('CMA_004', 'Venta al mayor asociada no encontrada', {
        ventaMayorId: cuadreMayor.ventaMayorId,
      });
    }
    if (ventaMayor.estado !== 'COMPLETADA') {
      throw new DomainException(
        'CMA_005',
        'La venta al mayor debe estar COMPLETADA antes de confirmar el cuadre',
        { ventaMayorId: cuadreMayor.ventaMayorId, estadoVenta: ventaMayor.estado },
      );
    }

    // Parsear valores del cuadre mayor
    const tandasAfectadas = this.parseTandasAfectadas(cuadreMayor.tandasAfectadas);
    const ingresoBruto = parseDecimalValue(cuadreMayor.ingresoBruto);
    const montoTotalAdmin = parseDecimalValue(cuadreMayor.montoTotalAdmin);
    const montoTotalVendedor = parseDecimalValue(cuadreMayor.montoTotalVendedor);

    // ========== 2. PREPARAR DATOS PARA TRANSACCIÓN ==========

    // 2.1 Preparar tandas a procesar
    const tandasParaProcesar = await this.prepararTandasParaProcesar(tandasAfectadas);

    // 2.2 Identificar tandas completamente consumidas (stock → 0)
    const tandasCompletamenteConsumidas = new Set<string>();
    for (const tanda of tandasParaProcesar) {
      if (tanda.stockRestanteDespuesConsumo <= 0) {
        tandasCompletamenteConsumidas.add(tanda.tandaId);
      }
    }

    // 2.3 Preparar cuadres a cerrar y distribuir deudasSaldadas
    const deudasSaldadas = parseDecimalValue(cuadreMayor.deudasSaldadas);
    const { cuadresParaCerrar, cuadresDeudaSaldada, equipamentoPago } =
      await this.prepararCuadresParaCerrar(
        cuadreMayor.lotesInvolucradosIds,
        tandasCompletamenteConsumidas,
        deudasSaldadas,
        cuadreMayor.vendedorId,
      );

    // 2.4b Calcular crédito parcial a cuadres con tanda parcialmente consumida
    const cuadresCreditoParcial = await this.prepararCuadresCreditoParcial(
      tandasParaProcesar,
      tandasCompletamenteConsumidas,
    );

    // 2.4 Calcular distribución prorrateada por lote
    const distribucionPorLote = this.calcularDistribucionPorLote(
      tandasAfectadas,
      ingresoBruto,
      montoTotalAdmin,
      montoTotalVendedor,
    );

    // 2.5 Preparar lote forzado si existe
    let loteForzadoData: ConfirmarCuadreMayorTransactionData['loteForzado'] = null;
    if (cuadreMayor.loteForzadoId) {
      const loteForzado = await this.loteRepository.findById(cuadreMayor.loteForzadoId);
      if (loteForzado) {
        loteForzadoData = {
          id: loteForzado.id,
          tandasIds: loteForzado.tandas.map((t) => t.id),
        };
      }
    }

    // ========== 3. EJECUTAR TRANSACCIÓN ATÓMICA ==========
    const transactionData: ConfirmarCuadreMayorTransactionData = {
      cuadreMayorId,
      montoTotalAdmin,
      ingresoBruto,
      tandasParaProcesar,
      cuadresParaCerrar,
      cuadresDeudaSaldada,
      cuadresCreditoParcial,
      equipamentoPago,
      distribucionPorLote,
      loteForzado: loteForzadoData,
    };

    const resultado =
      await this.cuadreMayorRepository.confirmarExitosoTransaccional(transactionData);

    this.logger.log(
      `Cuadre al mayor confirmado: ${cuadreMayorId} - ` +
        `Admin: $${montoTotalAdmin.toFixed(2)} - ` +
        `Cuadres cerrados: ${resultado.cuadresCerradosIds.length} - ` +
        `Cuadres crédito parcial: ${cuadresCreditoParcial.length} - ` +
        `Tandas completamente consumidas: ${tandasCompletamenteConsumidas.size} - ` +
        `Lotes actualizados: ${distribucionPorLote.length}`,
    );

    // ========== 4. ACCIONES POST-TRANSACCIÓN (eventos y comandos) ==========

    // 4.1 Registrar aporte al fondo por lote forzado
    if (cuadreMayor.loteForzadoId && loteForzadoData) {
      const loteForzado = await this.loteRepository.findById(cuadreMayor.loteForzadoId);
      if (loteForzado) {
        const aporteFondo = this.calculadoraInversion.calcularAporteFondo(
          loteForzado.cantidadTrabix,
        );
        await this.commandBus.execute(
          new RegistrarEntradaFondoCommand(
            aporteFondo,
            `Aporte por lote forzado ${loteForzado.id} (cuadre al mayor ${cuadreMayorId})`,
            loteForzado.id,
          ),
        );
        this.logger.log(
          `Entrada registrada en fondo de recompensas por lote forzado: $${aporteFondo.toFixed(2)}`,
        );
      }
    }

    // 4.2 Emitir eventos para últimas tandas con stock agotado
    for (const tandaAgotada of resultado.tandasConStockAgotadoUltimas) {
      this.logger.log(
        `Última tanda con stock 0. Activando mini-cuadre para tanda ${tandaAgotada.tandaId}`,
      );
      this.eventBus.publish(
        new StockUltimaTandaAgotadoEvent(tandaAgotada.tandaId, tandaAgotada.loteId),
      );
    }

    // 4.3 Emitir evento principal de cuadre exitoso
    this.eventBus.publish(
      new CuadreMayorExitosoEvent(
        cuadreMayorId,
        cuadreMayor.vendedorId,
        cuadreMayor.lotesInvolucradosIds,
        resultado.cuadresCerradosIds,
        cuadreMayor.loteForzadoId,
      ),
    );

    return resultado.cuadreMayor;
  }

  /**
   * Prepara la información de tandas necesaria para la transacción
   */
  private async prepararTandasParaProcesar(
    tandasAfectadas: TandaAfectada[],
  ): Promise<TandaParaProcesar[]> {
    const tandasParaProcesar: TandaParaProcesar[] = [];

    for (const tanda of tandasAfectadas) {
      // Obtener estado actual de la tanda
      const tandaActual = await this.tandaRepository.findById(tanda.tandaId);
      if (!tandaActual) {
        this.logger.warn(`Tanda no encontrada: ${tanda.tandaId}`);
        continue;
      }

      // Obtener lote para saber si es última tanda
      const lote = await this.loteRepository.findById(tanda.loteId);
      const esUltimaTanda = lote ? tanda.numeroTanda === lote.tandas.length : false;

      tandasParaProcesar.push({
        tandaId: tanda.tandaId,
        loteId: tanda.loteId,
        numeroTanda: tanda.numeroTanda,
        cantidadStockConsumido: tanda.cantidadStockConsumido,
        stockRestanteDespuesConsumo: tandaActual.stockActual - tanda.cantidadStockConsumido,
        esUltimaTanda,
        estadoActual: tandaActual.estado,
      });
    }

    return tandasParaProcesar;
  }

  /**
   * Prepara cuadres a cerrar por agotamiento de stock y distribuye deudasSaldadas.
   *
   * Paso 1: Cierra cuadres (INACTIVO o PENDIENTE) cuya tanda fue completamente consumida.
   * Paso 2: Calcula cuánto de deudasSaldadas fue cubierto por esos cierres de stock
   *         (solo aplica a cuadres que eran PENDIENTE antes de este cuadre mayor).
   * Paso 3: Distribuye el remanente de deudasSaldadas a otros cuadres PENDIENTE del vendedor.
   * Paso 4: Aplica cualquier remanente final a la deuda de equipamiento.
   */
  private async prepararCuadresParaCerrar(
    lotesInvolucradosIds: string[],
    tandasCompletamenteConsumidas: Set<string>,
    deudasSaldadas: Decimal,
    vendedorId: string,
  ): Promise<{
    cuadresParaCerrar: CuadreParaCerrar[];
    cuadresDeudaSaldada: CuadreDeudaSaldada[];
    equipamentoPago: EquipamentoPago | null;
  }> {
    const cuadresParaCerrar: CuadreParaCerrar[] = [];
    const closedByStockIds = new Set<string>();
    let deudaFromStockClosures = new Decimal(0);

    // Paso 1: cierres por agotamiento de stock
    for (const loteId of lotesInvolucradosIds) {
      const cuadresLote = await this.cuadreRepository.findByLoteId(loteId);

      for (const cuadre of cuadresLote) {
        if (
          (cuadre.estado === 'INACTIVO' || cuadre.estado === 'PENDIENTE') &&
          tandasCompletamenteConsumidas.has(cuadre.tandaId)
        ) {
          cuadresParaCerrar.push({
            cuadreId: cuadre.id,
            loteId,
            tandaId: cuadre.tandaId,
            montoEsperado: cuadre.montoEsperado.toString(),
          });
          closedByStockIds.add(cuadre.id);

          // Sólo cuadres PENDIENTE contribuyen a deudasSaldadas
          if (cuadre.estado === 'PENDIENTE') {
            const alreadyCovered = parseDecimalValue(cuadre.montoCubiertoPorMayor);
            const pendiente = parseDecimalValue(cuadre.montoEsperado).minus(alreadyCovered);
            if (pendiente.greaterThan(0)) {
              deudaFromStockClosures = deudaFromStockClosures.plus(pendiente);
            }
          }
        }
      }
    }

    this.logger.log(
      `Cuadres a cerrar: ${cuadresParaCerrar.length} ` +
        `(de ${tandasCompletamenteConsumidas.size} tandas completamente consumidas)`,
    );

    // Paso 2+3: distribuir remanente de deudasSaldadas a otros cuadres PENDIENTE
    const cuadresDeudaSaldada: CuadreDeudaSaldada[] = [];
    let remaining = Decimal.max(new Decimal(0), deudasSaldadas.minus(deudaFromStockClosures));

    if (remaining.greaterThan(0)) {
      const pendientesResult = await this.cuadreRepository.findByVendedorId(vendedorId, {
        where: { estado: 'PENDIENTE' },
        take: 100,
      });

      for (const cuadre of pendientesResult.data) {
        if (closedByStockIds.has(cuadre.id)) continue;
        if (remaining.lessThanOrEqualTo(0)) break;

        const montoEsperado = parseDecimalValue(cuadre.montoEsperado);
        const alreadyCovered = parseDecimalValue(cuadre.montoCubiertoPorMayor);
        const pendiente = montoEsperado.minus(alreadyCovered);

        if (pendiente.lessThanOrEqualTo(0)) continue;

        const montoCubrir = Decimal.min(remaining, pendiente);
        remaining = remaining.minus(montoCubrir);
        const nuevaCubierta = alreadyCovered.plus(montoCubrir);

        cuadresDeudaSaldada.push({
          cuadreId: cuadre.id,
          nuevaMontoCubiertoPorMayor: nuevaCubierta.toFixed(2),
          esFullClosure: montoCubrir.gte(pendiente),
        });
      }
    }

    // Paso 4: remanente final → deuda de equipamiento
    let equipamentoPago: EquipamentoPago | null = null;

    if (remaining.greaterThan(0)) {
      const equipamiento = await this.equipamientoRepository.findVigenteByVendedorId(vendedorId);
      if (equipamiento) {
        const entity = new EquipamientoEntity({
          ...equipamiento,
          deudaDano: equipamiento.deudaDano,
          deudaPerdida: equipamiento.deudaPerdida,
        });

        if (entity.tieneDeuda()) {
          let rem = remaining;

          // Prioridad: mensualidades → deudaDano → deudaPerdida
          const mensualidadesPendientes = entity.mensualidadesPendientes();
          const mensualidadActual = entity.mensualidadActual;
          let nuevaUltimaMensualidadPagada: Date | null = null;

          if (mensualidadesPendientes > 0 && rem.greaterThan(0)) {
            const montoMensualidades = mensualidadActual.times(mensualidadesPendientes);
            const pagoMensualidades = Decimal.min(rem, montoMensualidades);
            const periodosPagados = Math.floor(
              pagoMensualidades.div(mensualidadActual).toNumber(),
            );
            if (periodosPagados > 0) {
              const base = equipamiento.ultimaMensualidadPagada ?? new Date();
              nuevaUltimaMensualidadPagada = new Date(base);
              nuevaUltimaMensualidadPagada.setDate(
                nuevaUltimaMensualidadPagada.getDate() + periodosPagados * 30,
              );
              rem = rem.minus(mensualidadActual.times(periodosPagados));
            }
          }

          const deudaDanoReducir = Decimal.min(rem, entity.deudaDano);
          rem = rem.minus(deudaDanoReducir);
          const deudaPerdidaReducir = Decimal.min(rem, entity.deudaPerdida);

          equipamentoPago = {
            equipamientoId: equipamiento.id,
            deudaDanoReducir: deudaDanoReducir.toFixed(2),
            deudaPerdidaReducir: deudaPerdidaReducir.toFixed(2),
            nuevaUltimaMensualidadPagada,
          };
        }
      }
    }

    if (cuadresDeudaSaldada.length > 0 || equipamentoPago) {
      this.logger.log(
        `Distribución de deudasSaldadas: ${cuadresDeudaSaldada.length} cuadres acreditados, ` +
          `equipamiento=${equipamentoPago ? 'sí' : 'no'}`,
      );
    }

    return { cuadresParaCerrar, cuadresDeudaSaldada, equipamentoPago };
  }

  /**
   * Calcula crédito proporcional para cuadres cuya tanda fue PARCIALMENTE consumida.
   *
   * Para cada tanda en tandasParaProcesar que NO esté en tandasCompletamenteConsumidas:
   *  - Calcula stockOriginal = stockRestante + cantidadConsumida
   *  - Calcula proporción = cantidadConsumida / stockOriginal
   *  - Para cada cuadre INACTIVO o PENDIENTE de esa tanda:
   *      creditoParcial = proporcion * cuadre.montoEsperado
   *      nuevaCubierta  = min(montoEsperado, montoCubiertoPorMayor + creditoParcial)
   *    Si nuevaCubierta cambia → agregar a la lista de crédito parcial
   */
  private async prepararCuadresCreditoParcial(
    tandasParaProcesar: TandaParaProcesar[],
    tandasCompletamenteConsumidas: Set<string>,
  ): Promise<CuadreCreditoParcial[]> {
    const resultado: CuadreCreditoParcial[] = [];

    for (const tanda of tandasParaProcesar) {
      if (tandasCompletamenteConsumidas.has(tanda.tandaId)) continue;
      if (tanda.cantidadStockConsumido <= 0) continue;

      const stockOriginal = tanda.stockRestanteDespuesConsumo + tanda.cantidadStockConsumido;
      if (stockOriginal <= 0) continue;

      const proporcion = new Decimal(tanda.cantidadStockConsumido).div(stockOriginal);

      // Buscar cuadres INACTIVO o PENDIENTE de esta tanda
      try {
        const cuadresLote = await this.cuadreRepository.findByLoteId(tanda.loteId);
        for (const cuadre of cuadresLote) {
          if (cuadre.tandaId !== tanda.tandaId) continue;
          if (cuadre.estado !== 'INACTIVO' && cuadre.estado !== 'PENDIENTE') continue;

          const montoEsperado = parseDecimalValue(cuadre.montoEsperado);
          const alreadyCovered = parseDecimalValue(cuadre.montoCubiertoPorMayor);
          const creditoParcial = proporcion.times(montoEsperado);
          const nuevaCubierta = Decimal.min(montoEsperado, alreadyCovered.plus(creditoParcial));

          if (nuevaCubierta.greaterThan(alreadyCovered)) {
            resultado.push({
              cuadreId: cuadre.id,
              nuevaMontoCubiertaPorMayor: nuevaCubierta.toFixed(2),
            });
            this.logger.debug(
              `Crédito parcial calculado para cuadre ${cuadre.id}: ` +
                `proporcion=${proporcion.toFixed(4)} creditoParcial=$${creditoParcial.toFixed(2)} ` +
                `nuevaCubierta=$${nuevaCubierta.toFixed(2)}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Error calculando crédito parcial para tanda ${tanda.tandaId}: ${error}`,
        );
      }
    }

    return resultado;
  }

  /**
   * Calcula la distribución de montos prorrateada por lote
   * basándose en el stock consumido de cada lote
   */
  private calcularDistribucionPorLote(
    tandasAfectadas: TandaAfectada[],
    ingresoBruto: Decimal,
    montoTotalAdmin: Decimal,
    montoTotalVendedor: Decimal,
  ): DistribucionMontoLote[] {
    // Agrupar stock consumido por lote
    const stockPorLote = new Map<string, number>();

    for (const tanda of tandasAfectadas) {
      const actual = stockPorLote.get(tanda.loteId) || 0;
      stockPorLote.set(tanda.loteId, actual + tanda.cantidadStockConsumido);
    }

    // Calcular total de stock consumido
    const stockTotal = [...stockPorLote.values()].reduce((a, b) => a + b, 0);

    if (stockTotal === 0) {
      this.logger.warn('Stock total consumido es 0, no se puede prorratear');
      return [];
    }

    // Calcular distribución proporcional
    const distribucion: DistribucionMontoLote[] = [];

    for (const [loteId, stockConsumido] of stockPorLote) {
      const proporcion = new Decimal(stockConsumido).div(stockTotal);

      distribucion.push({
        loteId,
        stockConsumido,
        montoRecaudado: ingresoBruto.mul(proporcion),
        montoTransferido: montoTotalAdmin.mul(proporcion),
        montoVendedor: montoTotalVendedor.mul(proporcion),
      });

      this.logger.debug(
        `Prorrateo para lote ${loteId}: ` +
          `${stockConsumido}/${stockTotal} unidades = ${proporcion.mul(100).toFixed(2)}%`,
      );
    }

    return distribucion;
  }

  /**
   * Parsea las tandas afectadas desde el JSON almacenado
   */
  private parseTandasAfectadas(data: unknown): TandaAfectada[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: Record<string, unknown>) => ({
      tandaId: String(item.tandaId ?? ''),
      cantidadStockConsumido: Number(item.cantidadStockConsumido ?? 0),
      numeroTanda: Number(item.numeroTanda ?? 0),
      loteId: String(item.loteId ?? ''),
    }));
  }
}
