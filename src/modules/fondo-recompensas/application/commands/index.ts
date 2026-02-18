import { CommandHandler, ICommandHandler, ICommand, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IFondoRecompensasRepository,
  FONDO_RECOMPENSAS_REPOSITORY,
  FondoRecompensasService,
  MovimientoFondo,
} from '../../domain';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
} from '../../../usuarios/domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import {
  EnviarNotificacionCommand,
  EnviarNotificacionARolCommand,
} from '../../../notificaciones/application/commands';

// ========== RegistrarEntradaFondoCommand ==========

/**
 * Command para registrar una entrada al fondo (automático al activar lote)
 */
export class RegistrarEntradaFondoCommand implements ICommand {
  constructor(
    public readonly monto: Decimal,
    public readonly concepto: string,
    public readonly loteId?: string,
  ) {}
}

@CommandHandler(RegistrarEntradaFondoCommand)
export class RegistrarEntradaFondoHandler implements ICommandHandler<
  RegistrarEntradaFondoCommand,
  MovimientoFondo
> {
  private readonly logger = new Logger(RegistrarEntradaFondoHandler.name);

  constructor(
    @Inject(FONDO_RECOMPENSAS_REPOSITORY)
    private readonly fondoRepository: IFondoRecompensasRepository,
  ) {}

  async execute(command: RegistrarEntradaFondoCommand): Promise<MovimientoFondo> {
    const movimiento = await this.fondoRepository.registrarEntrada({
      tipo: 'ENTRADA',
      monto: command.monto,
      concepto: command.concepto,
      loteId: command.loteId,
    });

    this.logger.log(`Entrada registrada: $${command.monto.toFixed(2)} - ${command.concepto}`);

    return movimiento;
  }
}

// ========== RegistrarSalidaFondoCommand ==========

/**
 * Command para registrar una salida del fondo (premio/bono a vendedor)
 *
 * Validaciones:
 * 1. El vendedor beneficiario existe y está activo
 * 2. El monto es mayor a 0
 * 3. El fondo tiene saldo suficiente
 *
 * Acciones:
 * 1. Registrar el movimiento de salida
 * 2. Notificar al vendedor beneficiario (PREMIO_RECIBIDO)
 * 3. Notificar a todos los demás vendedores (FONDO_EGRESO)
 */
export class RegistrarSalidaFondoCommand implements ICommand {
  constructor(
    public readonly monto: Decimal,
    public readonly concepto: string,
    public readonly vendedorBeneficiarioId: string,
    public readonly adminId: string,
  ) {}
}

@CommandHandler(RegistrarSalidaFondoCommand)
export class RegistrarSalidaFondoHandler implements ICommandHandler<
  RegistrarSalidaFondoCommand,
  MovimientoFondo
> {
  private readonly logger = new Logger(RegistrarSalidaFondoHandler.name);

  constructor(
    @Inject(FONDO_RECOMPENSAS_REPOSITORY)
    private readonly fondoRepository: IFondoRecompensasRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly fondoService: FondoRecompensasService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RegistrarSalidaFondoCommand): Promise<MovimientoFondo> {
    const { monto, concepto, vendedorBeneficiarioId, adminId } = command;

    // 1. Validar que el vendedor beneficiario existe
    const vendedor = await this.usuarioRepository.findById(vendedorBeneficiarioId);
    if (!vendedor) {
      throw new DomainException('FND_003', 'Vendedor beneficiario no encontrado', {
        vendedorBeneficiarioId,
      });
    }

    if (vendedor.eliminado) {
      throw new DomainException('FND_003', 'Vendedor beneficiario no encontrado', {
        vendedorBeneficiarioId,
      });
    }

    if (vendedor.estado !== 'ACTIVO') {
      throw new DomainException('FND_004', 'El vendedor beneficiario debe estar activo', {
        estadoVendedor: vendedor.estado,
      });
    }

    // 2. Obtener saldo actual y validar
    const saldoActual = await this.fondoRepository.obtenerSaldo();
    this.fondoService.validarSalida(saldoActual, monto);

    // 3. Registrar salida con el beneficiario
    const movimiento = await this.fondoRepository.registrarSalida({
      tipo: 'SALIDA',
      monto: monto,
      concepto: concepto,
      vendedorBeneficiarioId: vendedorBeneficiarioId,
    });

    this.logger.log(
      `Salida registrada: $${monto.toFixed(2)} - ${concepto} - Beneficiario: ${vendedorBeneficiarioId} - Admin: ${adminId}`,
    );

    const beneficiarioNombre = `${vendedor.nombre} ${vendedor.apellidos}`;

    // 4. Notificar al vendedor beneficiario (PREMIO_RECIBIDO)
    try {
      await this.commandBus.execute(
        new EnviarNotificacionCommand(vendedorBeneficiarioId, 'PREMIO_RECIBIDO', {
          monto: monto.toNumber(),
          concepto: concepto,
          fecha: movimiento.fechaTransaccion,
        }),
      );
      this.logger.log(
        `Notificación PREMIO_RECIBIDO enviada al beneficiario: ${vendedorBeneficiarioId}`,
      );
    } catch (error) {
      // No fallar si la notificación falla
      this.logger.warn(
        `Error enviando notificación al beneficiario ${vendedorBeneficiarioId}: ${error}`,
      );
    }

    // 5. Notificar a TODOS los demás vendedores (FONDO_EGRESO)
    try {
      await this.commandBus.execute(
        new EnviarNotificacionARolCommand(
          'VENDEDOR',
          'FONDO_EGRESO',
          {
            monto: monto.toNumber(),
            concepto: concepto,
            beneficiarioNombre,
            fecha: movimiento.fechaTransaccion,
          },
          vendedorBeneficiarioId, // Excluir al beneficiario (ya recibió PREMIO_RECIBIDO)
        ),
      );
      this.logger.log(`Notificación FONDO_EGRESO enviada a vendedores activos`);
    } catch (error) {
      this.logger.warn(`Error enviando notificación FONDO_EGRESO a vendedores: ${error}`);
    }

    return movimiento;
  }
}

// Export handlers array
export const FondoRecompensasCommandHandlers = [
  RegistrarEntradaFondoHandler,
  RegistrarSalidaFondoHandler,
];
