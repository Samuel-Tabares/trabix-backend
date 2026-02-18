import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { ICuadreRepository, CUADRE_REPOSITORY } from '../../domain/cuadre.repository.interface';
import { CuadreEntity } from '../../domain/cuadre.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { CuadreExitosoEvent } from '../events/cuadre-exitoso.event';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';

/**
 * Command para confirmar un cuadre como exitoso
 */
export class ConfirmarCuadreCommand implements ICommand {
  constructor(
    public readonly cuadreId: string,
    public readonly montoRecibido: number,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ConfirmarCuadre
 * Según sección 17.6 del documento
 *
 * Validaciones:
 * - Cuadre existe y está PENDIENTE
 * - monto_recibido >= monto_esperado
 * - Admin confirma
 *
 * Al confirmar exitoso (TODOo EN TRANSACCIÓN):
 * - Reduce deudas de equipamiento del vendedor
 * - Registra pago de mensualidad
 * - Actualiza estado a EXITOSO
 * - Publica CuadreExitosoEvent (libera siguiente tanda)
 *
 * INTEGRACIÓN EQUIPAMIENTO:
 * - Al confirmar, se reducen las deudas de daño/pérdida
 * - Se registra el pago de mensualidad
 * - Si falla cualquier operación, se hace rollback completo
 */
@CommandHandler(ConfirmarCuadreCommand)
export class ConfirmarCuadreHandler implements ICommandHandler<ConfirmarCuadreCommand> {
  private readonly logger = new Logger(ConfirmarCuadreHandler.name);

  constructor(
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConfirmarCuadreCommand): Promise<any> {
    const { cuadreId, montoRecibido, adminId } = command;

    // Buscar el cuadre (fuera de transacción para validaciones)
    const cuadre = await this.cuadreRepository.findById(cuadreId);
    if (!cuadre) {
      throw new DomainException('CUA_001', 'Cuadre no encontrado', { cuadreId });
    }

    // Crear entidad de dominio para validaciones
    const cuadreEntity = new CuadreEntity({
      ...cuadre,
      montoEsperado: cuadre.montoEsperado,
      montoRecibido: cuadre.montoRecibido,
      montoFaltante: cuadre.montoFaltante,
      montoCubiertoPorMayor: cuadre.montoCubiertoPorMayor,
    });

    // Validar que se puede confirmar
    const montoRecibidoDecimal = new Decimal(montoRecibido);
    cuadreEntity.validarConfirmacion(montoRecibidoDecimal);

    const vendedorId = cuadre.tanda.lote?.vendedorId;
    if (!vendedorId) {
      throw new DomainException('CUA_004', 'Vendedor no encontrado en el cuadre', { cuadreId });
    }

    // Ejecutar todoo en una transacción
    const cuadreActualizado = await this.ejecutarConfirmacionEnTransaccion(
      cuadreId,
      vendedorId,
      montoRecibidoDecimal,
    );

    this.logger.log(
      `Cuadre confirmado exitoso: ${cuadreId} - Monto: $${montoRecibido} - Admin: ${adminId}`,
    );

    // Publicar evento CuadreExitosoEvent (fuera de transacción)
    this.eventBus.publish(
      new CuadreExitosoEvent(
        cuadreId,
        cuadre.tandaId,
        cuadre.tanda.loteId,
        vendedorId,
        montoRecibidoDecimal,
        cuadre.tanda.numero,
      ),
    );

    return cuadreActualizado;
  }

  /**
   * Ejecuta la confirmación del cuadre y procesamiento de deudas en una transacción
   * Si falla cualquier operación, se hace rollback completo
   */
  private async ejecutarConfirmacionEnTransaccion(
    cuadreId: string,
    vendedorId: string,
    montoRecibido: Decimal,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Procesar deudas de equipamiento
      await this.procesarDeudasEquipamientoEnTransaccion(tx, vendedorId);

      // 2. Confirmar el cuadre como exitoso
      const cuadre = await tx.cuadre.findUnique({ where: { id: cuadreId } });
      if (!cuadre) {
        throw new DomainException('CUA_001', 'Cuadre no encontrado', { cuadreId });
      }

      const montoEsperado = new Decimal(cuadre.montoEsperado);
      const montoCubierto = new Decimal(cuadre.montoCubiertoPorMayor);
      const montoRequerido = montoEsperado.minus(montoCubierto);
      const montoFaltante = montoRequerido.minus(montoRecibido);

      const cuadreActualizado = await tx.cuadre.update({
        where: { id: cuadreId },
        data: {
          estado: 'EXITOSO',
          montoRecibido: montoRecibido.toFixed(2),
          montoFaltante: montoFaltante.greaterThan(0) ? montoFaltante.toFixed(2) : '0',
          fechaExitoso: new Date(),
          version: { increment: 1 },
        },
      });

      return cuadreActualizado;
    });
  }

  /**
   * Procesa las deudas de equipamiento del vendedor dentro de la transacción
   * - Reduce deuda de daño a 0
   * - Reduce deuda de pérdida a 0
   * - Registra pago de mensualidad
   *
   * @throws Error si falla cualquier operación (causa rollback)
   */
  private async procesarDeudasEquipamientoEnTransaccion(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    vendedorId: string,
  ): Promise<void> {
    // Buscar equipamiento activo del vendedor
    const equipamiento = await tx.equipamiento.findFirst({
      where: {
        vendedorId,
        estado: { in: ['SOLICITADO', 'ACTIVO'] },
      },
    });

    if (!equipamiento) {
      this.logger.debug(`Vendedor ${vendedorId} no tiene equipamiento activo`);
      return;
    }

    const deudaDano = new Decimal(equipamiento.deudaDano || 0);
    const deudaPerdida = new Decimal(equipamiento.deudaPerdida || 0);
    const operaciones: string[] = [];

    // Reducir deuda de daño si existe
    if (deudaDano.greaterThan(0)) {
      await tx.equipamiento.update({
        where: { id: equipamiento.id },
        data: {
          deudaDano: { decrement: Number.parseFloat(deudaDano.toFixed(2)) },
        },
      });
      operaciones.push(`deuda daño: -$${deudaDano.toFixed(2)}`);
    }

    // Reducir deuda de pérdida si existe
    if (deudaPerdida.greaterThan(0)) {
      await tx.equipamiento.update({
        where: { id: equipamiento.id },
        data: {
          deudaPerdida: { decrement: Number.parseFloat(deudaPerdida.toFixed(2)) },
        },
      });
      operaciones.push(`deuda pérdida: -$${deudaPerdida.toFixed(2)}`);
    }

    // Registrar pago de mensualidad solo si el equipamiento está ACTIVO
    if (equipamiento.estado === 'ACTIVO') {
      await tx.equipamiento.update({
        where: { id: equipamiento.id },
        data: {
          ultimaMensualidadPagada: new Date(),
        },
      });
      operaciones.push('mensualidad registrada');
    }

    if (operaciones.length > 0) {
      this.logger.log(`Equipamiento ${equipamiento.id} actualizado: ${operaciones.join(', ')}`);
    }
  }
}
