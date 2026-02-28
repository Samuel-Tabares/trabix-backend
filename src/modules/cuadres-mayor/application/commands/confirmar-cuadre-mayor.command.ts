import { CommandHandler, ICommandHandler, ICommand, EventBus, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  ICuadreMayorRepository,
  CUADRE_MAYOR_REPOSITORY,
  ConfirmarCuadreMayorTransactionData,
  TandaParaProcesar,
  CuadreParaCerrar,
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

    // 2.3 Preparar cuadres a cerrar — SOLO de tandas completamente consumidas
    const cuadresParaCerrar = await this.prepararCuadresParaCerrar(
      cuadreMayor.lotesInvolucradosIds,
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
      distribucionPorLote,
      loteForzado: loteForzadoData,
    };

    const resultado =
      await this.cuadreMayorRepository.confirmarExitosoTransaccional(transactionData);

    this.logger.log(
      `Cuadre al mayor confirmado: ${cuadreMayorId} - ` +
        `Admin: $${montoTotalAdmin.toFixed(2)} - ` +
        `Cuadres cerrados: ${resultado.cuadresCerradosIds.length} - ` +
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
   * Prepara la lista de cuadres normales que deben cerrarse
   *
   * FIX: Solo cierra cuadres cuya tanda fue COMPLETAMENTE consumida (stock → 0)
   * Antes: cerraba TODOS los cuadres de todos los lotes involucrados
   * Ahora: solo cierra cuadres de tandas donde stockRestante === 0
   *
   * Además, guarda el montoEsperado de cada cuadre para usarlo como
   * montoCubiertoPorMayor (antes se usaba montoTotalAdmin global para todos)
   */
  private async prepararCuadresParaCerrar(
    lotesInvolucradosIds: string[],
    tandasCompletamenteConsumidas: Set<string>,
  ): Promise<CuadreParaCerrar[]> {
    const cuadresParaCerrar: CuadreParaCerrar[] = [];

    for (const loteId of lotesInvolucradosIds) {
      const cuadresLote = await this.cuadreRepository.findByLoteId(loteId);

      for (const cuadre of cuadresLote) {
        // Solo cerrar cuadres INACTIVOS o PENDIENTES
        // Y SOLO si la tanda asociada fue completamente consumida
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
        }
      }
    }

    this.logger.log(
      `Cuadres a cerrar: ${cuadresParaCerrar.length} ` +
        `(de ${tandasCompletamenteConsumidas.size} tandas completamente consumidas)`,
    );

    return cuadresParaCerrar;
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
