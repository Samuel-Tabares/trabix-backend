import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
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
import { CreateVentaDto } from '../dto/create-venta.dto';

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
 * Según sección 6 del documento
 *
 * Flujo:
 * 1. Vendedor registra venta colectiva
 * 2. Venta queda en estado PENDIENTE
 * 3. Stock se reduce temporalmente
 *
 * Lógica de consumo de stock:
 * - Las ventas consumen siempre el lote activo más antiguo
 * - Consume de la tanda EN_CASA actual
 */
@CommandHandler(RegistrarVentaCommand)
export class RegistrarVentaHandler implements ICommandHandler<
  RegistrarVentaCommand,
  VentaConDetalles
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
  ) {}

  async execute(command: RegistrarVentaCommand): Promise<VentaConDetalles> {
    const { vendedorId, data } = command;

    // Calcular cantidad total de TRABIX usando el servicio
    const cantidadTrabix = this.calculadoraPrecios.calcularCantidadTrabix(data.detalles);

    // 1. Verificar que el vendedor puede vender (todas las validaciones)
    const { lote, tanda } = await this.vendedorPuedeVender.verificar(vendedorId, cantidadTrabix);

    // 2. Calcular cantidad de regalos y verificar límite
    const cantidadRegalos = data.detalles
      .filter((d) => d.tipo === 'REGALO')
      .reduce((sum, d) => sum + d.cantidad, 0);

    if (cantidadRegalos > 0) {
      await this.regaloPermitido.verificar(lote.id, lote.cantidadTrabix, cantidadRegalos);
    }

    // 3. Calcular monto total y detalles usando el servicio de precios
    const resultadoCalculo = this.calculadoraPrecios.calcularVenta(data.detalles);

    // 4. Reducir stock temporalmente (se confirma o revierte según aprobación)
    await this.tandaRepository.consumirStock(tanda.id, cantidadTrabix);

    // 5. Crear la venta en estado PENDIENTE
    const venta = await this.ventaRepository.create({
      vendedorId,
      loteId: lote.id,
      tandaId: tanda.id,
      montoTotal: resultadoCalculo.montoTotal,
      cantidadTrabix,
      detalles: resultadoCalculo.detallesConPrecios,
    });

    this.logger.log(
      `Venta registrada: ${venta.id} - ${cantidadTrabix} TRABIX, $${resultadoCalculo.montoTotal.toFixed(2)} - Vendedor: ${vendedorId}`,
    );

    return venta;
  }
}
