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
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegistrarVentaCommand): Promise<VentaConDetalles> {
    const { vendedorId, data } = command;

    // Calcular cantidad total de TRABIX
    const cantidadTrabix = this.calculadoraPrecios.calcularCantidadTrabix(data.detalles);

    // 1. Verificar que el vendedor puede vender (stock, estado, lote activo, etc.)
    const { lote, tanda } = await this.vendedorPuedeVender.verificar(vendedorId, cantidadTrabix);

    // 2. Verificar límite de regalos
    const cantidadRegalos = data.detalles
      .filter((d) => d.tipo === 'REGALO')
      .reduce((sum, d) => sum + d.cantidad, 0);

    if (cantidadRegalos > 0) {
      await this.regaloPermitido.verificar(lote.id, lote.cantidadTrabix, cantidadRegalos);
    }

    // 3. Calcular monto total y detalles
    const resultadoCalculo = this.calculadoraPrecios.calcularVenta(data.detalles);

    // 4. Reducir stock de la tanda
    await this.tandaRepository.consumirStock(tanda.id, cantidadTrabix);

    // 5. Persistir la venta
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

    // 6. Publicar evento para efectos de dominio (recaudo, cuadre, notificaciones)
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

    return venta;
  }
}
