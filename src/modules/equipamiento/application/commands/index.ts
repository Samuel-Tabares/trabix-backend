import { CommandHandler, ICommandHandler, ICommand, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IEquipamientoRepository,
  EQUIPAMIENTO_REPOSITORY,
} from '../../domain/equipamiento.repository.interface';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import { EquipamientoEntity } from '../../domain/equipamiento.entity';
import { EquipamientoConfigService } from '../../domain/equipamiento-config.service';
import { ActualizadorCuadresVendedorService } from '../../../cuadres/domain/actualizador-cuadres-vendedor.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import {
  EnviarNotificacionCommand,
  EnviarNotificacionARolCommand,
} from '../../../notificaciones/application/commands';

/**
 * Resultado de operaciones que afectan cuadres
 */
export interface ResultadoConAdvertencia {
  equipamiento: any;
  advertenciaCuadres?: string;
}

// ========== SolicitarEquipamientoCommand ==========
// Ejecutado por: VENDEDOR

export class SolicitarEquipamientoCommand implements ICommand {
  constructor(
    public readonly vendedorId: string,
    public readonly tieneDeposito: boolean,
  ) {}
}

@CommandHandler(SolicitarEquipamientoCommand)
export class SolicitarEquipamientoHandler
  implements ICommandHandler<SolicitarEquipamientoCommand>
{
  private readonly logger = new Logger(SolicitarEquipamientoHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly equipamientoConfig: EquipamientoConfigService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: SolicitarEquipamientoCommand): Promise<any> {
    // Verificar que el vendedor existe y está activo
    const vendedor = await this.usuarioRepository.findById(command.vendedorId);
    if (!vendedor || vendedor.estado !== 'ACTIVO') {
      throw new DomainException('EQU_005', 'Vendedor no encontrado o no activo');
    }

    // Verificar que el usuario sea VENDEDOR
    if (vendedor.rol !== 'VENDEDOR') {
      throw new DomainException(
        'EQU_011',
        'Solo los vendedores pueden solicitar equipamiento',
        { rolActual: vendedor.rol },
      );
    }

    // Verificar que no tenga equipamiento activo/solicitado
    const existente = await this.equipamientoRepository.findActivoByVendedorId(command.vendedorId);
    if (existente) {
      throw new DomainException(
        'EQU_006',
        'El vendedor ya tiene equipamiento activo o solicitado',
        { estadoActual: existente.estado },
      );
    }

    // Calcular mensualidad según depósito usando ConfigService
    const mensualidad = this.equipamientoConfig.calcularMensualidad(command.tieneDeposito);
    const deposito = command.tieneDeposito ? this.equipamientoConfig.deposito : undefined;

    // Crear equipamiento
    const equipamiento = await this.equipamientoRepository.create({
      vendedorId: command.vendedorId,
      tieneDeposito: command.tieneDeposito,
      depositoPagado: deposito,
      mensualidadActual: mensualidad,
    });

    this.logger.log(
      `Equipamiento solicitado: ${equipamiento.id} - ` +
      `Vendedor: ${command.vendedorId} - ` +
      `Con depósito: ${command.tieneDeposito} - ` +
      `Mensualidad: $${mensualidad.toFixed(0)}`,
    );

    // Notificar al vendedor (confirmación de solicitud)
    try {
      await this.commandBus.execute(
        new EnviarNotificacionCommand(
          command.vendedorId,
          'EQUIPAMIENTO_SOLICITADO',
          {
            equipamientoId: equipamiento.id,
            tieneDeposito: command.tieneDeposito,
            esParaAdmin: false,
          },
        ),
      );
    } catch (error) {
      this.logger.warn(`Error enviando notificación al vendedor: ${error}`);
    }

    // Notificar a todos los ADMIN (solicitud pendiente)
    try {
      const vendedorNombre = `${vendedor.nombre} ${vendedor.apellidos}`;
      await this.commandBus.execute(
        new EnviarNotificacionARolCommand(
          'ADMIN',
          'EQUIPAMIENTO_SOLICITADO',
          {
            equipamientoId: equipamiento.id,
            vendedorId: command.vendedorId,
            vendedorNombre,
            tieneDeposito: command.tieneDeposito,
            esParaAdmin: true,
          },
        ),
      );
    } catch (error) {
      this.logger.warn(`Error enviando notificación a admins: ${error}`);
    }

    return equipamiento;
  }
}

// ========== ActivarEquipamientoCommand ==========
// Ejecutado por: ADMIN
// Representa la entrega física del equipamiento al vendedor

export class ActivarEquipamientoCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(ActivarEquipamientoCommand)
export class ActivarEquipamientoHandler
  implements ICommandHandler<ActivarEquipamientoCommand>
{
  private readonly logger = new Logger(ActivarEquipamientoHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ActivarEquipamientoCommand): Promise<any> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });
    entity.validarActivacion();

    const activado = await this.equipamientoRepository.activar(command.equipamientoId);

    this.logger.log(
      `Equipamiento activado: ${command.equipamientoId} - ` +
      `Admin: ${command.adminId} - ` +
      `Vendedor: ${equipamiento.vendedorId}`,
    );

    // Notificar al vendedor que su equipamiento fue entregado
    try {
      await this.commandBus.execute(
        new EnviarNotificacionCommand(
          equipamiento.vendedorId,
          'EQUIPAMIENTO_ENTREGADO',
          {
            equipamientoId: command.equipamientoId,
          },
        ),
      );
    } catch (error) {
      this.logger.warn(`Error enviando notificación EQUIPAMIENTO_ENTREGADO: ${error}`);
    }

    return activado;
  }
}

// ========== ReportarDanoCommand ==========
// Ejecutado por: ADMIN
// Solo aumenta la deuda, NO cambia el estado
// Actualiza cuadres del vendedor después de reportar
// PUNTO 8: No silencia errores, retorna advertencia si falla actualización de cuadres

export class ReportarDanoCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly tipoDano: 'NEVERA' | 'PIJAMA',
    public readonly adminId: string,
  ) {}
}

@CommandHandler(ReportarDanoCommand)
export class ReportarDanoHandler implements ICommandHandler<ReportarDanoCommand> {
  private readonly logger = new Logger(ReportarDanoHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly equipamientoConfig: EquipamientoConfigService,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  async execute(command: ReportarDanoCommand): Promise<ResultadoConAdvertencia> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });
    entity.validarReporteDano();

    // Obtener costo del daño desde configuración
    const monto = this.equipamientoConfig.getCostoDano(command.tipoDano);

    const danado = await this.equipamientoRepository.reportarDano(
      command.equipamientoId,
      command.tipoDano,
      monto,
    );

    this.logger.log(
      `Daño reportado: ${command.equipamientoId} - ` +
      `Tipo: ${command.tipoDano} - ` +
      `Monto: $${monto.toFixed(0)} - ` +
      `Admin: ${command.adminId}`,
    );

    // Intentar actualizar cuadres del vendedor
    let advertenciaCuadres: string | undefined;
    try {
      await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
        equipamiento.vendedorId,
        `Daño reportado: ${command.tipoDano} ($${monto.toFixed(0)})`,
      );
    } catch (error) {
      // PUNTO 8: No silenciar, registrar y advertir al admin
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error actualizando cuadres después de reportar daño: ${errorMsg}`,
      );
      advertenciaCuadres =
        `El daño fue registrado correctamente, pero hubo un error al actualizar los cuadres del vendedor. ` +
        `Es posible que los cuadres no reflejen esta deuda. Error: ${errorMsg}`;
    }

    return {
      equipamiento: danado,
      advertenciaCuadres,
    };
  }
}

// ========== ReportarPerdidaCommand ==========
// Ejecutado por: ADMIN
// Pérdida total del equipamiento (nevera + pijama)
// PUNTO 8: No silencia errores, retorna advertencia si falla actualización de cuadres

export class ReportarPerdidaCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(ReportarPerdidaCommand)
export class ReportarPerdidaHandler implements ICommandHandler<ReportarPerdidaCommand> {
  private readonly logger = new Logger(ReportarPerdidaHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly equipamientoConfig: EquipamientoConfigService,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  async execute(command: ReportarPerdidaCommand): Promise<ResultadoConAdvertencia> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });
    entity.validarReportePerdida();

    // Costo total de pérdida desde configuración
    const monto = this.equipamientoConfig.costoPerdidaTotal;

    const perdido = await this.equipamientoRepository.reportarPerdida(
      command.equipamientoId,
      monto,
    );

    this.logger.log(
      `Pérdida reportada: ${command.equipamientoId} - ` +
      `Monto: $${monto.toFixed(0)} - ` +
      `Admin: ${command.adminId}`,
    );

    // Intentar actualizar cuadres del vendedor
    let advertenciaCuadres: string | undefined;
    try {
      await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
        equipamiento.vendedorId,
        `Pérdida total reportada ($${monto.toFixed(0)})`,
      );
    } catch (error) {
      // PUNTO 8: No silenciar, registrar y advertir al admin
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error actualizando cuadres después de reportar pérdida: ${errorMsg}`,
      );
      advertenciaCuadres =
        `La pérdida fue registrada correctamente, pero hubo un error al actualizar los cuadres del vendedor. ` +
        `Es posible que los cuadres no reflejen esta deuda. Error: ${errorMsg}`;
    }

    return {
      equipamiento: perdido,
      advertenciaCuadres,
    };
  }
}

// ========== DevolverEquipamientoCommand ==========
// Ejecutado por: ADMIN
// Solo si no hay deudas pendientes

export class DevolverEquipamientoCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(DevolverEquipamientoCommand)
export class DevolverEquipamientoHandler
  implements ICommandHandler<DevolverEquipamientoCommand>
{
  private readonly logger = new Logger(DevolverEquipamientoHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
  ) {}

  async execute(command: DevolverEquipamientoCommand): Promise<any> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });
    entity.validarDevolucion();

    // Devolver equipamiento
    let devuelto = await this.equipamientoRepository.devolver(command.equipamientoId);

    // Si tiene depósito, devolverlo
    if (equipamiento.tieneDeposito && !equipamiento.depositoDevuelto) {
      devuelto = await this.equipamientoRepository.devolverDeposito(command.equipamientoId);
      this.logger.log(`Depósito devuelto: ${command.equipamientoId}`);
    }

    this.logger.log(
      `Equipamiento devuelto: ${command.equipamientoId} - ` +
      `Admin: ${command.adminId}`,
    );

    return devuelto;
  }
}

// ========== PUNTO 7: Commands para pago manual de deudas ==========

// ========== PagarMensualidadCommand ==========
// Ejecutado por: ADMIN
// Registra pago de mensualidad (fuera del flujo de cuadres)

export class PagarMensualidadCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(PagarMensualidadCommand)
export class PagarMensualidadHandler implements ICommandHandler<PagarMensualidadCommand> {
  private readonly logger = new Logger(PagarMensualidadHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  async execute(command: PagarMensualidadCommand): Promise<ResultadoConAdvertencia> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    // Solo se puede pagar mensualidad de equipamiento ACTIVO
    if (equipamiento.estado !== 'ACTIVO') {
      throw new DomainException(
        'EQU_012',
        'Solo se puede pagar mensualidad de equipamiento ACTIVO',
        { estadoActual: equipamiento.estado },
      );
    }

    const entity = new EquipamientoEntity({
      ...equipamiento,
      deudaDano: equipamiento.deudaDano,
      deudaPerdida: equipamiento.deudaPerdida,
    });

    // Verificar que haya mensualidad pendiente
    if (entity.mensualidadAlDia()) {
      throw new DomainException(
        'EQU_013',
        'La mensualidad ya está al día',
        {
          ultimaMensualidadPagada: equipamiento.ultimaMensualidadPagada,
          diasMora: entity.diasMoraMensualidad(),
        },
      );
    }

    const actualizado = await this.equipamientoRepository.registrarPagoMensualidad(
      command.equipamientoId,
    );

    this.logger.log(
      `Mensualidad pagada: ${command.equipamientoId} - ` +
      `Vendedor: ${equipamiento.vendedorId} - ` +
      `Admin: ${command.adminId}`,
    );

    // Intentar actualizar cuadres
    let advertenciaCuadres: string | undefined;
    try {
      await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
        equipamiento.vendedorId,
        `Mensualidad pagada manualmente`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error actualizando cuadres después de pagar mensualidad: ${errorMsg}`);
      advertenciaCuadres =
        `El pago de mensualidad fue registrado, pero hubo un error al actualizar los cuadres. ` +
        `Error: ${errorMsg}`;
    }

    return {
      equipamiento: actualizado,
      advertenciaCuadres,
    };
  }
}

// ========== PagarDeudaDanoCommand ==========
// Ejecutado por: ADMIN
// Permite abonar parcialmente o pagar total de deuda por daño

export class PagarDeudaDanoCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly monto: number,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(PagarDeudaDanoCommand)
export class PagarDeudaDanoHandler implements ICommandHandler<PagarDeudaDanoCommand> {
  private readonly logger = new Logger(PagarDeudaDanoHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  async execute(command: PagarDeudaDanoCommand): Promise<ResultadoConAdvertencia> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const deudaActual = new Decimal(equipamiento.deudaDano || 0);
    const montoAbono = new Decimal(command.monto);

    // Validaciones
    if (montoAbono.lessThanOrEqualTo(0)) {
      throw new DomainException(
        'EQU_014',
        'El monto a pagar debe ser mayor a cero',
      );
    }

    if (deudaActual.lessThanOrEqualTo(0)) {
      throw new DomainException(
        'EQU_015',
        'No hay deuda por daño pendiente',
        { deudaDano: deudaActual.toFixed(2) },
      );
    }

    if (montoAbono.greaterThan(deudaActual)) {
      throw new DomainException(
        'EQU_016',
        'El monto a pagar excede la deuda pendiente',
        {
          deudaPendiente: deudaActual.toFixed(2),
          montoIntentado: montoAbono.toFixed(2),
        },
      );
    }

    const actualizado = await this.equipamientoRepository.reducirDeudaDano(
      command.equipamientoId,
      montoAbono,
    );

    this.logger.log(
      `Deuda daño reducida: ${command.equipamientoId} - ` +
      `Monto: $${montoAbono.toFixed(0)} - ` +
      `Deuda anterior: $${deudaActual.toFixed(0)} - ` +
      `Deuda nueva: $${deudaActual.minus(montoAbono).toFixed(0)} - ` +
      `Admin: ${command.adminId}`,
    );

    // Intentar actualizar cuadres
    let advertenciaCuadres: string | undefined;
    try {
      await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
        equipamiento.vendedorId,
        `Abono a deuda por daño ($${montoAbono.toFixed(0)})`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error actualizando cuadres después de pagar deuda daño: ${errorMsg}`);
      advertenciaCuadres =
        `El abono fue registrado, pero hubo un error al actualizar los cuadres. ` +
        `Error: ${errorMsg}`;
    }

    return {
      equipamiento: actualizado,
      advertenciaCuadres,
    };
  }
}

// ========== PagarDeudaPerdidaCommand ==========
// Ejecutado por: ADMIN
// Permite abonar parcialmente o pagar total de deuda por pérdida

export class PagarDeudaPerdidaCommand implements ICommand {
  constructor(
    public readonly equipamientoId: string,
    public readonly monto: number,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(PagarDeudaPerdidaCommand)
export class PagarDeudaPerdidaHandler implements ICommandHandler<PagarDeudaPerdidaCommand> {
  private readonly logger = new Logger(PagarDeudaPerdidaHandler.name);

  constructor(
    @Inject(EQUIPAMIENTO_REPOSITORY)
    private readonly equipamientoRepository: IEquipamientoRepository,
    private readonly actualizadorCuadres: ActualizadorCuadresVendedorService,
  ) {}

  async execute(command: PagarDeudaPerdidaCommand): Promise<ResultadoConAdvertencia> {
    const equipamiento = await this.equipamientoRepository.findById(command.equipamientoId);
    if (!equipamiento) {
      throw new DomainException('EQU_007', 'Equipamiento no encontrado');
    }

    const deudaActual = new Decimal(equipamiento.deudaPerdida || 0);
    const montoAbono = new Decimal(command.monto);

    // Validaciones
    if (montoAbono.lessThanOrEqualTo(0)) {
      throw new DomainException(
        'EQU_014',
        'El monto a pagar debe ser mayor a cero',
      );
    }

    if (deudaActual.lessThanOrEqualTo(0)) {
      throw new DomainException(
        'EQU_017',
        'No hay deuda por pérdida pendiente',
        { deudaPerdida: deudaActual.toFixed(2) },
      );
    }

    if (montoAbono.greaterThan(deudaActual)) {
      throw new DomainException(
        'EQU_016',
        'El monto a pagar excede la deuda pendiente',
        {
          deudaPendiente: deudaActual.toFixed(2),
          montoIntentado: montoAbono.toFixed(2),
        },
      );
    }

    const actualizado = await this.equipamientoRepository.reducirDeudaPerdida(
      command.equipamientoId,
      montoAbono,
    );

    this.logger.log(
      `Deuda pérdida reducida: ${command.equipamientoId} - ` +
      `Monto: $${montoAbono.toFixed(0)} - ` +
      `Deuda anterior: $${deudaActual.toFixed(0)} - ` +
      `Deuda nueva: $${deudaActual.minus(montoAbono).toFixed(0)} - ` +
      `Admin: ${command.adminId}`,
    );

    // Intentar actualizar cuadres
    let advertenciaCuadres: string | undefined;
    try {
      await this.actualizadorCuadres.actualizarPorCambioDeudaEquipamiento(
        equipamiento.vendedorId,
        `Abono a deuda por pérdida ($${montoAbono.toFixed(0)})`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error actualizando cuadres después de pagar deuda pérdida: ${errorMsg}`);
      advertenciaCuadres =
        `El abono fue registrado, pero hubo un error al actualizar los cuadres. ` +
        `Error: ${errorMsg}`;
    }

    return {
      equipamiento: actualizado,
      advertenciaCuadres,
    };
  }
}

// Export handlers array
export const EquipamientoCommandHandlers = [
  SolicitarEquipamientoHandler,
  ActivarEquipamientoHandler,
  ReportarDanoHandler,
  ReportarPerdidaHandler,
  DevolverEquipamientoHandler,
  // Nuevos handlers para pago manual (Punto 7)
  PagarMensualidadHandler,
  PagarDeudaDanoHandler,
  PagarDeudaPerdidaHandler,
];