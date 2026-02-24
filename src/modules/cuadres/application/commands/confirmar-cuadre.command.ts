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

    // Ejecutar en una transacción atómica
    const { cuadre: cuadreActualizado, estaCompleto } =
      await this.ejecutarConfirmacionEnTransaccion(cuadreId, vendedorId, montoRecibidoDecimal);

    if (estaCompleto) {
      this.logger.log(
        `Cuadre confirmado exitoso: ${cuadreId} - Monto total: $${montoRecibido} - Admin: ${adminId}`,
      );
      // Publicar CuadreExitosoEvent solo cuando el cuadre queda completamente pagado
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
    } else {
      this.logger.log(
        `Abono parcial registrado en cuadre: ${cuadreId} - Abono: $${montoRecibido} - Admin: ${adminId}`,
      );
    }

    return cuadreActualizado;
  }

  /**
   * Ejecuta el abono al cuadre en una transacción atómica.
   * - Acumula montoRecibido sobre el valor ya existente.
   * - Solo marca EXITOSO y procesa deudas de equipamiento cuando el faltante llega a 0.
   * Retorna { cuadre, estaCompleto } para que execute() decida si publicar el evento.
   */
  private async ejecutarConfirmacionEnTransaccion(
    cuadreId: string,
    vendedorId: string,
    montoAbono: Decimal,
  ): Promise<{ cuadre: any; estaCompleto: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const cuadre = await tx.cuadre.findUnique({ where: { id: cuadreId } });
      if (!cuadre) {
        throw new DomainException('CUA_001', 'Cuadre no encontrado', { cuadreId });
      }

      const montoEsperado = new Decimal(cuadre.montoEsperado);
      const montoCubierto = new Decimal(cuadre.montoCubiertoPorMayor);
      const montoRequerido = montoEsperado.minus(montoCubierto);
      const montoAcumulado = new Decimal(cuadre.montoRecibido).plus(montoAbono);
      const nuevoFaltante = montoRequerido.minus(montoAcumulado);
      const estaCompleto = nuevoFaltante.lessThanOrEqualTo(0);

      if (estaCompleto) {
        // Pago completo: procesar deudas de equipamiento y marcar EXITOSO
        await this.procesarDeudasEquipamientoEnTransaccion(tx, vendedorId, cuadreId);
      }

      const cuadreActualizado = await tx.cuadre.update({
        where: { id: cuadreId },
        data: {
          montoRecibido: montoAcumulado.toFixed(2),
          montoFaltante: estaCompleto ? '0' : nuevoFaltante.toFixed(2),
          ...(estaCompleto && { estado: 'EXITOSO', fechaExitoso: new Date() }),
          version: { increment: 1 },
        },
      });

      return { cuadre: cuadreActualizado, estaCompleto };
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
    cuadreId: string,
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
    // BUG-008 FIX: Use { set: 0 } instead of { decrement: staleAmount }.
    // Decrementing by a value read outside the transaction can produce a
    // negative deudaDano if another operation modified it concurrently.
    // Setting to 0 is both the correct intent (clear all debt) and atomic-safe.
    if (deudaDano.greaterThan(0)) {
      await tx.equipamiento.update({
        where: { id: equipamiento.id },
        data: {
          deudaDano: { set: 0 },
        },
      });
      await tx.abonoEquipamiento.create({
        data: {
          equipamientoId: equipamiento.id,
          tipo: 'DANO',
          monto: deudaDano.toFixed(2),
          cuadreId,
        },
      });
      operaciones.push(`deuda daño: -$${deudaDano.toFixed(2)}`);
    }

    // Reducir deuda de pérdida si existe
    if (deudaPerdida.greaterThan(0)) {
      await tx.equipamiento.update({
        where: { id: equipamiento.id },
        data: {
          deudaPerdida: { set: 0 },
        },
      });
      await tx.abonoEquipamiento.create({
        data: {
          equipamientoId: equipamiento.id,
          tipo: 'PERDIDA',
          monto: deudaPerdida.toFixed(2),
          cuadreId,
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
      await tx.abonoEquipamiento.create({
        data: {
          equipamientoId: equipamiento.id,
          tipo: 'MENSUALIDAD',
          monto: new Decimal(equipamiento.mensualidadActual).toFixed(2),
          cuadreId,
        },
      });
      operaciones.push('mensualidad registrada');
    }

    if (operaciones.length > 0) {
      this.logger.log(`Equipamiento ${equipamiento.id} actualizado: ${operaciones.join(', ')}`);
    }
  }
}
