import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ModalidadVentaMayor } from '@prisma/client';
import {
  IVentaMayorRepository,
  VENTA_MAYOR_REPOSITORY,
} from '../../domain/venta-mayor.repository.interface';
import { ILoteRepository, LOTE_REPOSITORY } from '../../../lotes/domain/lote.repository.interface';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import { VentaMayorEntity } from '../../domain/venta-mayor.entity';
import { ConsumidorStockMayorService } from '../../domain/consumidor-stock-mayor.service';
import { CalculadoraPreciosMayorService } from '../../domain/calculadora-precios-mayor.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { VentaMayorRegistradaEvent } from '../events/venta-mayor-registrada.event';

/**
 * Command para registrar una venta al mayor
 */
export class RegistrarVentaMayorCommand implements ICommand {
  constructor(
    public readonly vendedorId: string,
    public readonly cantidadUnidades: number,
    public readonly conLicor: boolean,
    public readonly modalidad: ModalidadVentaMayor,
  ) {}
}

/**
 * Handler del comando RegistrarVentaMayor
 * Según sección 7 del documento
 */
@CommandHandler(RegistrarVentaMayorCommand)
export class RegistrarVentaMayorHandler implements ICommandHandler<RegistrarVentaMayorCommand> {
  private readonly logger = new Logger(RegistrarVentaMayorHandler.name);

  constructor(
    @Inject(VENTA_MAYOR_REPOSITORY)
    private readonly ventaMayorRepository: IVentaMayorRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly consumidorStock: ConsumidorStockMayorService,
    private readonly calculadoraPrecios: CalculadoraPreciosMayorService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegistrarVentaMayorCommand): Promise<any> {
    const { vendedorId, cantidadUnidades, conLicor, modalidad } = command;

    // Validar cantidad mínima (>=20)
    VentaMayorEntity.validarCantidadMinima(cantidadUnidades);

    // Validar vendedor activo
    const vendedor = await this.usuarioRepository.findById(vendedorId);
    if (!vendedor) {
      throw new DomainException('VMA_003', 'Vendedor no encontrado', { vendedorId });
    }
    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException('VMA_004', 'El vendedor no está activo', {
        estado: vendedor.estado,
      });
    }

    // Obtener lotes activos del vendedor
    const lotes = await this.loteRepository.findByVendedor(vendedorId);
    const lotesActivos = lotes.data.filter((l: any) => l.estado === 'ACTIVO');

    // Generar plan de consumo de stock
    const planConsumo = this.consumidorStock.generarPlanConsumo(
      cantidadUnidades,
      lotesActivos.map((l: any) => ({
        id: l.id,
        cantidadTrabix: l.cantidadTrabix,
        estado: l.estado,
        fechaActivacion: l.fechaActivacion,
        tandas: l.tandas.map((t: any) => ({
          id: t.id,
          loteId: l.id,
          numero: t.numero,
          stockActual: t.stockActual,
          stockInicial: t.stockInicial,
          estado: t.estado,
        })),
      })),
    );

    // Calcular precio unitario e ingreso bruto usando el servicio
    const resultadoCalculo = this.calculadoraPrecios.calcularVentaMayor(cantidadUnidades, conLicor);

    // Crear la venta al mayor (el lote forzado se crea en el cuadre si es necesario)
    const venta = await this.ventaMayorRepository.create({
      vendedorId,
      cantidadUnidades,
      precioUnidad: resultadoCalculo.precioUnidad,
      ingresoBruto: resultadoCalculo.ingresoBruto,
      conLicor,
      modalidad,
      fuentesStock: planConsumo.fuentesStock,
      lotesInvolucradosIds: planConsumo.lotesInvolucrados,
      loteForzadoId: undefined, // Se creará si es necesario en el cuadre
    });

    this.logger.log(
      `Venta al mayor registrada: ${venta.id} - ${cantidadUnidades} unidades - $${resultadoCalculo.ingresoBruto.toFixed(2)}`,
    );

    // Publicar evento
    this.eventBus.publish(
      new VentaMayorRegistradaEvent(
        venta.id,
        vendedorId,
        cantidadUnidades,
        resultadoCalculo.ingresoBruto,
        modalidad,
        planConsumo.necesitaLoteForzado,
        planConsumo.cantidadLoteForzado,
        planConsumo.lotesInvolucrados,
      ),
    );

    return venta;
  }
}
