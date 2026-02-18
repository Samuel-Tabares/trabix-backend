import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IPedidoStockRepository,
  PEDIDO_STOCK_REPOSITORY,
  IConfiguracionRepository,
  CONFIGURACION_REPOSITORY,
  ITipoInsumoRepository,
  TIPO_INSUMO_REPOSITORY,
  IStockAdminRepository,
  STOCK_ADMIN_REPOSITORY,
} from '../../domain/repositories';
import {
  PedidoStockEntity,
  DetalleCostoEntity,
  ConfiguracionSistemaEntity,
  TipoInsumoEntity,
} from '../../domain/entities';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

// ========== CrearPedidoStockCommand ==========

export class CrearPedidoStockCommand implements ICommand {
  constructor(
    public readonly cantidadTrabix: number,
    public readonly notas?: string,
  ) {}
}

@CommandHandler(CrearPedidoStockCommand)
export class CrearPedidoStockHandler implements ICommandHandler<CrearPedidoStockCommand> {
  private readonly logger = new Logger(CrearPedidoStockHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(command: CrearPedidoStockCommand): Promise<any> {
    const pedido = await this.pedidoRepository.create({
      cantidadTrabix: command.cantidadTrabix,
      notas: command.notas,
    });

    this.logger.log(`Pedido creado: ${pedido.id} - ${command.cantidadTrabix} TRABIX`);
    return pedido;
  }
}

// ========== ModificarPedidoStockCommand ==========

export class ModificarPedidoStockCommand implements ICommand {
  constructor(
    public readonly pedidoId: string,
    public readonly cantidadTrabix?: number,
    public readonly notas?: string,
  ) {}
}

@CommandHandler(ModificarPedidoStockCommand)
export class ModificarPedidoStockHandler implements ICommandHandler<ModificarPedidoStockCommand> {
  private readonly logger = new Logger(ModificarPedidoStockHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(command: ModificarPedidoStockCommand): Promise<any> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    if (pedido.estado !== 'BORRADOR') {
      throw new DomainException('PED_008', 'Solo se pueden modificar pedidos en estado BORRADOR', {
        estadoActual: pedido.estado,
      });
    }

    const actualizado = await this.pedidoRepository.update(command.pedidoId, {
      cantidadTrabix: command.cantidadTrabix,
      notas: command.notas,
    });

    this.logger.log(`Pedido ${command.pedidoId} modificado`);
    return actualizado;
  }
}

// ========== AgregarCostoPedidoCommand ==========

export class AgregarCostoPedidoCommand implements ICommand {
  constructor(
    public readonly pedidoId: string,
    public readonly concepto: string,
    public readonly esObligatorio: boolean,
    public readonly costoTotal: number,
    public readonly cantidad?: number,
  ) {}
}

@CommandHandler(AgregarCostoPedidoCommand)
export class AgregarCostoPedidoHandler implements ICommandHandler<AgregarCostoPedidoCommand> {
  private readonly logger = new Logger(AgregarCostoPedidoHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(command: AgregarCostoPedidoCommand): Promise<any> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    const entity = new PedidoStockEntity({
      ...pedido,
      costoTotal: pedido.costoTotal,
      costoRealPorTrabix: pedido.costoRealPorTrabix,
      detallesCosto: pedido.detallesCosto.map(
        (d) => new DetalleCostoEntity({ ...d, costoTotal: d.costoTotal }),
      ),
    });
    entity.validarAgregarCosto();

    const costo = await this.pedidoRepository.agregarCosto({
      pedidoId: command.pedidoId,
      concepto: command.concepto,
      esObligatorio: command.esObligatorio,
      cantidad: command.cantidad,
      costoTotal: new Decimal(command.costoTotal),
    });

    this.logger.log(`Costo agregado: ${costo.id} - ${command.concepto}: $${command.costoTotal}`);
    return costo;
  }
}

// ========== EliminarCostoPedidoCommand ==========

export class EliminarCostoPedidoCommand implements ICommand {
  constructor(
    public readonly pedidoId: string,
    public readonly costoId: string,
  ) {}
}

@CommandHandler(EliminarCostoPedidoCommand)
export class EliminarCostoPedidoHandler implements ICommandHandler<EliminarCostoPedidoCommand> {
  private readonly logger = new Logger(EliminarCostoPedidoHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(command: EliminarCostoPedidoCommand): Promise<void> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    const entity = new PedidoStockEntity({
      ...pedido,
      costoTotal: pedido.costoTotal,
      costoRealPorTrabix: pedido.costoRealPorTrabix,
    });
    entity.validarAgregarCosto(); // Misma validación - solo en BORRADOR

    await this.pedidoRepository.eliminarCosto(command.costoId);
    this.logger.log(`Costo eliminado: ${command.costoId}`);
  }
}

// ========== ConfirmarPedidoStockCommand ==========

export class ConfirmarPedidoStockCommand implements ICommand {
  constructor(public readonly pedidoId: string) {}
}

@CommandHandler(ConfirmarPedidoStockCommand)
export class ConfirmarPedidoStockHandler implements ICommandHandler<ConfirmarPedidoStockCommand> {
  private readonly logger = new Logger(ConfirmarPedidoStockHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
    @Inject(TIPO_INSUMO_REPOSITORY)
    private readonly tipoInsumoRepository: ITipoInsumoRepository,
  ) {}

  async execute(command: ConfirmarPedidoStockCommand): Promise<any> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    // Obtener insumos obligatorios
    const insumosObligatorios = await this.tipoInsumoRepository.findObligatorios();
    const nombresObligatorios = insumosObligatorios.map((i) => i.nombre);

    const entity = new PedidoStockEntity({
      ...pedido,
      costoTotal: pedido.costoTotal,
      costoRealPorTrabix: pedido.costoRealPorTrabix,
      detallesCosto: pedido.detallesCosto.map(
        (d) => new DetalleCostoEntity({ ...d, costoTotal: d.costoTotal }),
      ),
    });

    entity.validarConfirmacion(nombresObligatorios);

    // Calcular costos
    const costoTotal = entity.calcularCostoTotal();
    const costoRealPorTrabix = entity.calcularCostoRealPorTrabix();

    const confirmado = await this.pedidoRepository.confirmar(
      command.pedidoId,
      costoTotal,
      costoRealPorTrabix,
    );

    this.logger.log(
      `Pedido confirmado: ${command.pedidoId} - ` +
        `Costo total: $${costoTotal.toFixed(2)} - ` +
        `Costo/TRABIX: $${costoRealPorTrabix.toFixed(2)}`,
    );

    return confirmado;
  }
}

// ========== RecibirPedidoStockCommand ==========

export class RecibirPedidoStockCommand implements ICommand {
  constructor(public readonly pedidoId: string) {}
}

@CommandHandler(RecibirPedidoStockCommand)
export class RecibirPedidoStockHandler implements ICommandHandler<RecibirPedidoStockCommand> {
  private readonly logger = new Logger(RecibirPedidoStockHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
    @Inject(STOCK_ADMIN_REPOSITORY)
    private readonly stockAdminRepository: IStockAdminRepository,
  ) {}

  async execute(command: RecibirPedidoStockCommand): Promise<any> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    const entity = new PedidoStockEntity({
      ...pedido,
      costoTotal: pedido.costoTotal,
      costoRealPorTrabix: pedido.costoRealPorTrabix,
    });
    entity.validarRecepcion();

    // Incrementar stock físico
    await this.stockAdminRepository.incrementarStock(pedido.cantidadTrabix, pedido.id);

    const recibido = await this.pedidoRepository.recibir(command.pedidoId);

    this.logger.log(
      `Pedido recibido: ${command.pedidoId} - Stock incrementado: +${pedido.cantidadTrabix}`,
    );

    return recibido;
  }
}

// ========== CancelarPedidoStockCommand ==========

export class CancelarPedidoStockCommand implements ICommand {
  constructor(
    public readonly pedidoId: string,
    public readonly motivo: string,
  ) {}
}

@CommandHandler(CancelarPedidoStockCommand)
export class CancelarPedidoStockHandler implements ICommandHandler<CancelarPedidoStockCommand> {
  private readonly logger = new Logger(CancelarPedidoStockHandler.name);

  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(command: CancelarPedidoStockCommand): Promise<any> {
    const pedido = await this.pedidoRepository.findById(command.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    const entity = new PedidoStockEntity({
      ...pedido,
      costoTotal: pedido.costoTotal,
      costoRealPorTrabix: pedido.costoRealPorTrabix,
    });
    entity.validarCancelacion();

    const cancelado = await this.pedidoRepository.cancelar(command.pedidoId, command.motivo);

    this.logger.log(`Pedido cancelado: ${command.pedidoId} - Motivo: ${command.motivo}`);

    return cancelado;
  }
}

// ========== ModificarConfiguracionCommand ==========

export class ModificarConfiguracionCommand implements ICommand {
  constructor(
    public readonly clave: string,
    public readonly valor: string,
    public readonly adminId: string,
    public readonly motivo?: string,
  ) {}
}

@CommandHandler(ModificarConfiguracionCommand)
export class ModificarConfiguracionHandler implements ICommandHandler<ModificarConfiguracionCommand> {
  private readonly logger = new Logger(ModificarConfiguracionHandler.name);

  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly configuracionRepository: IConfiguracionRepository,
  ) {}

  async execute(command: ModificarConfiguracionCommand): Promise<any> {
    const config = await this.configuracionRepository.findByClave(command.clave);
    if (!config) {
      throw new DomainException('CFG_002', 'Configuración no encontrada');
    }

    const entity = new ConfiguracionSistemaEntity(config);
    entity.validarModificacion();

    // Registrar historial
    await this.configuracionRepository.registrarHistorial({
      clave: command.clave,
      valorAnterior: config.valor,
      valorNuevo: command.valor,
      modificadoPorId: command.adminId,
      motivo: command.motivo,
    });

    // Actualizar configuración
    const actualizada = await this.configuracionRepository.actualizar(
      command.clave,
      command.valor,
      command.adminId,
    );

    this.logger.log(
      `Configuración modificada: ${command.clave} - ${config.valor} → ${command.valor}`,
    );

    return actualizada;
  }
}

// ========== CrearTipoInsumoCommand ==========

export class CrearTipoInsumoCommand implements ICommand {
  constructor(
    public readonly nombre: string,
    public readonly esObligatorio?: boolean,
  ) {}
}

@CommandHandler(CrearTipoInsumoCommand)
export class CrearTipoInsumoHandler implements ICommandHandler<CrearTipoInsumoCommand> {
  private readonly logger = new Logger(CrearTipoInsumoHandler.name);

  constructor(
    @Inject(TIPO_INSUMO_REPOSITORY)
    private readonly tipoInsumoRepository: ITipoInsumoRepository,
  ) {}

  async execute(command: CrearTipoInsumoCommand): Promise<any> {
    // Verificar que no existe
    const existente = await this.tipoInsumoRepository.findByNombre(command.nombre);
    if (existente) {
      throw new DomainException('INS_002', 'Ya existe un tipo de insumo con ese nombre');
    }

    const tipoInsumo = await this.tipoInsumoRepository.create({
      nombre: command.nombre,
      esObligatorio: command.esObligatorio,
    });

    this.logger.log(`Tipo de insumo creado: ${tipoInsumo.id} - ${command.nombre}`);
    return tipoInsumo;
  }
}

// ========== ModificarTipoInsumoCommand ==========

export class ModificarTipoInsumoCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly nombre?: string,
  ) {}
}

@CommandHandler(ModificarTipoInsumoCommand)
export class ModificarTipoInsumoHandler implements ICommandHandler<ModificarTipoInsumoCommand> {
  private readonly logger = new Logger(ModificarTipoInsumoHandler.name);

  constructor(
    @Inject(TIPO_INSUMO_REPOSITORY)
    private readonly tipoInsumoRepository: ITipoInsumoRepository,
  ) {}

  async execute(command: ModificarTipoInsumoCommand): Promise<any> {
    const tipoInsumo = await this.tipoInsumoRepository.findById(command.id);
    if (!tipoInsumo) {
      throw new DomainException('INS_003', 'Tipo de insumo no encontrado');
    }

    // Verificar nombre único si se modifica
    if (command.nombre && command.nombre !== tipoInsumo.nombre) {
      const existente = await this.tipoInsumoRepository.findByNombre(command.nombre);
      if (existente) {
        throw new DomainException('INS_002', 'Ya existe un tipo de insumo con ese nombre');
      }
    }

    const actualizado = await this.tipoInsumoRepository.update(command.id, {
      nombre: command.nombre,
    });

    this.logger.log(`Tipo de insumo modificado: ${command.id}`);
    return actualizado;
  }
}

// ========== DesactivarTipoInsumoCommand ==========

export class DesactivarTipoInsumoCommand implements ICommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DesactivarTipoInsumoCommand)
export class DesactivarTipoInsumoHandler implements ICommandHandler<DesactivarTipoInsumoCommand> {
  private readonly logger = new Logger(DesactivarTipoInsumoHandler.name);

  constructor(
    @Inject(TIPO_INSUMO_REPOSITORY)
    private readonly tipoInsumoRepository: ITipoInsumoRepository,
  ) {}

  async execute(command: DesactivarTipoInsumoCommand): Promise<any> {
    const tipoInsumo = await this.tipoInsumoRepository.findById(command.id);
    if (!tipoInsumo) {
      throw new DomainException('INS_003', 'Tipo de insumo no encontrado');
    }

    const entity = new TipoInsumoEntity(tipoInsumo);
    entity.validarDesactivacion();

    const desactivado = await this.tipoInsumoRepository.desactivar(command.id);

    this.logger.log(`Tipo de insumo desactivado: ${command.id}`);
    return desactivado;
  }
}

// Export handlers array
export const AdminCommandHandlers = [
  CrearPedidoStockHandler,
  ModificarPedidoStockHandler,
  AgregarCostoPedidoHandler,
  EliminarCostoPedidoHandler,
  ConfirmarPedidoStockHandler,
  RecibirPedidoStockHandler,
  CancelarPedidoStockHandler,
  ModificarConfiguracionHandler,
  CrearTipoInsumoHandler,
  ModificarTipoInsumoHandler,
  DesactivarTipoInsumoHandler,
];
