import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  IVentaRepository,
  VENTA_REPOSITORY,
  VentaConDetalles,
} from '../../domain/venta.repository.interface';
import {
  ITandaRepository,
  TANDA_REPOSITORY,
} from '../../../lotes/domain/tanda.repository.interface';
import { VendedorPuedeVenderSpecification } from '../../domain/vendedor-puede-vender.specification';
import { RegaloPermitidoSpecification } from '../../domain/regalo-permitido.specification';
import { CalculadoraPreciosVentaService } from '../../domain/calculadora-precios-venta.service';
import { CalculadoraCrossLoteService } from '../../domain/calculadora-cross-lote.service';
import { CreateVentaDto } from '../dto/create-venta.dto';
import { VentaRegistradaEvent } from '../events/venta-aprobada.event';

/**
 * Command para registrar una venta
 */
export class RegistrarVentaCommand implements ICommand {
  constructor(
    public readonly vendedorId: string,
    public readonly data: CreateVentaDto,
  ) {}
}

/**
 * Handler del comando RegistrarVenta
 *
 * La venta se confirma automáticamente al registrarse.
 * Los efectos de dominio (recaudo, trigger de cuadre, notificaciones)
 * se procesan sincrónicamente vía VentaRegistradaEvent.
 *
 * Cuando hay cross-lote:
 * - Se divide la venta entre la última tanda del lote1 y la tanda EN_CASA del lote2
 * - Se registran 2 ventas separadas y se publican 2 eventos
 * - El VentaRegistradaEvent del lote1 (stock=0 en última tanda) activa el mini-cuadre automáticamente
 */
@CommandHandler(RegistrarVentaCommand)
export class RegistrarVentaHandler implements ICommandHandler<
  RegistrarVentaCommand,
  RegistrarVentaResult
> {
  private readonly logger = new Logger(RegistrarVentaHandler.name);

  constructor(
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepository: IVentaRepository,
    @Inject(TANDA_REPOSITORY)
    private readonly tandaRepository: ITandaRepository,
    private readonly vendedorPuedeVender: VendedorPuedeVenderSpecification,
    private readonly regaloPermitido: RegaloPermitidoSpecification,
    private readonly calculadoraPrecios: CalculadoraPreciosVentaService,
    private readonly calculadoraCrossLote: CalculadoraCrossLoteService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegistrarVentaCommand): Promise<RegistrarVentaResult> {
    const { vendedorId, data } = command;

    // Calcular cantidad total de TRABIX
    const cantidadTrabix = this.calculadoraPrecios.calcularCantidadTrabix(data.detalles);

    // 1. Verificar que el vendedor puede vender
    const { lote, tanda, crossLote } = await this.vendedorPuedeVender.verificar(
      vendedorId,
      cantidadTrabix,
    );

    // 2. Verificar límite de regalos
    const cantidadRegalos = data.detalles
      .filter((d) => d.tipo === 'REGALO')
      .reduce((sum, d) => sum + d.cantidad, 0);

    if (cantidadRegalos > 0) {
      await this.regaloPermitido.verificar(lote.id, lote.cantidadTrabix, cantidadRegalos);
    }

    if (crossLote) {
      const esCrossTanda = crossLote.lote.id === lote.id;

      if (esCrossTanda) {
        // === VENTA CROSS-TANDA (mismo lote, dos tandas EN_CASA) ===
        // Stock: se consume el resto de la tanda vieja y el excedente de la tanda nueva.
        // Financiero: el monto completo va al cuadre de la tanda nueva (la activa).
        const excedente = cantidadTrabix - crossLote.stockRestanteLote1;

        await this.tandaRepository.consumirStock(tanda.id, crossLote.stockRestanteLote1);
        // Tanda vieja llega a 0 → finalizarla directamente (el event de tanda2 no la cubre)
        await this.tandaRepository.finalizar(tanda.id);

        await this.tandaRepository.consumirStock(crossLote.tanda.id, excedente);

        const calcCrossTanda = this.calculadoraPrecios.calcularVenta(data.detalles);

        const venta = await this.ventaRepository.create({
          vendedorId,
          loteId: lote.id,
          tandaId: crossLote.tanda.id, // cuadre de la tanda nueva
          montoTotal: calcCrossTanda.montoTotal,
          cantidadTrabix,
          detalles: calcCrossTanda.detallesConPrecios,
        });

        this.logger.log(
          `[Cross-Tanda] Venta: ${venta.id} - ${cantidadTrabix} TRABIX, ` +
            `$${calcCrossTanda.montoTotal.toFixed(2)} - ` +
            `${crossLote.stockRestanteLote1} de tanda antigua + ${excedente} de tanda nueva`,
        );

        this.eventBus.publish(
          new VentaRegistradaEvent(
            venta.id,
            vendedorId,
            lote.id,
            crossLote.tanda.id,
            calcCrossTanda.montoTotal,
            cantidadTrabix,
          ),
        );

        return { venta, esCrossLote: false };
      }

      // === VENTA CROSS-LOTE (lotes distintos) ===
      // Dividir ítems entre lote1 y lote2; cada lote registra su propia venta
      const split = this.calculadoraCrossLote.calcular(data.detalles, crossLote.stockRestanteLote1);

      // --- Lote 1: consumir el stock restante ---
      const calcLote1 = this.calculadoraPrecios.calcularVenta(split.itemsLote1);
      await this.tandaRepository.consumirStock(tanda.id, split.trabixLote1);

      const ventaLote1 = await this.ventaRepository.create({
        vendedorId,
        loteId: lote.id,
        tandaId: tanda.id,
        montoTotal: calcLote1.montoTotal,
        cantidadTrabix: split.trabixLote1,
        detalles: calcLote1.detallesConPrecios,
      });

      this.logger.log(
        `[Cross-Lote] Venta Lote1: ${ventaLote1.id} - ${split.trabixLote1} TRABIX, ` +
          `$${calcLote1.montoTotal.toFixed(2)} - Lote: ${lote.id}`,
      );

      this.eventBus.publish(
        new VentaRegistradaEvent(
          ventaLote1.id,
          vendedorId,
          lote.id,
          tanda.id,
          calcLote1.montoTotal,
          split.trabixLote1,
        ),
      );

      // --- Lote 2: registrar el excedente ---
      const calcLote2 = this.calculadoraPrecios.calcularVenta(split.itemsLote2);
      await this.tandaRepository.consumirStock(crossLote.tanda.id, split.trabixLote2);

      const ventaLote2 = await this.ventaRepository.create({
        vendedorId,
        loteId: crossLote.lote.id,
        tandaId: crossLote.tanda.id,
        montoTotal: calcLote2.montoTotal,
        cantidadTrabix: split.trabixLote2,
        detalles: calcLote2.detallesConPrecios,
      });

      this.logger.log(
        `[Cross-Lote] Venta Lote2: ${ventaLote2.id} - ${split.trabixLote2} TRABIX, ` +
          `$${calcLote2.montoTotal.toFixed(2)} - Lote: ${crossLote.lote.id}`,
      );

      this.eventBus.publish(
        new VentaRegistradaEvent(
          ventaLote2.id,
          vendedorId,
          crossLote.lote.id,
          crossLote.tanda.id,
          calcLote2.montoTotal,
          split.trabixLote2,
        ),
      );

      return {
        venta: ventaLote2,
        ventaCrossLote: ventaLote1,
        esCrossLote: true,
      };
    }

    // === VENTA NORMAL ===
    const resultadoCalculo = this.calculadoraPrecios.calcularVenta(data.detalles);

    await this.tandaRepository.consumirStock(tanda.id, cantidadTrabix);

    const venta = await this.ventaRepository.create({
      vendedorId,
      loteId: lote.id,
      tandaId: tanda.id,
      montoTotal: resultadoCalculo.montoTotal,
      cantidadTrabix,
      detalles: resultadoCalculo.detallesConPrecios,
    });

    this.logger.log(
      `Venta registrada: ${venta.id} - ${cantidadTrabix} TRABIX, ` +
        `$${resultadoCalculo.montoTotal.toFixed(2)} - Vendedor: ${vendedorId}`,
    );

    this.eventBus.publish(
      new VentaRegistradaEvent(
        venta.id,
        vendedorId,
        lote.id,
        tanda.id,
        resultadoCalculo.montoTotal,
        cantidadTrabix,
      ),
    );

    return { venta, esCrossLote: false };
  }
}

/**
 * Resultado del comando RegistrarVenta
 */
export interface RegistrarVentaResult {
  /** Venta principal (lote2 en cross-lote, única venta en flujo normal) */
  venta: VentaConDetalles;
  /** Venta en lote1 que cierra su stock (solo en cross-lote) */
  ventaCrossLote?: VentaConDetalles;
  esCrossLote: boolean;
}
