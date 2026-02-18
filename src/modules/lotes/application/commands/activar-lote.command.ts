import { CommandHandler, ICommandHandler, ICommand, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  ILoteRepository,
  LOTE_REPOSITORY,
  LoteConTandas,
} from '../../../lotes/domain/lote.repository.interface';
import { LoteEntity } from '../../domain/lote.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { LoteActivadoEvent } from '../events/lote-activado.event';

/**
 * Command para activar un lote
 */
export class ActivarLoteCommand implements ICommand {
  constructor(
    public readonly loteId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ActivarLote
 * Según sección 3.2 del documento:
 * Admin valida transferencia → Tanda 1 se libera → Estado: ACTIVO
 *
 * Acciones (LoteActivadoEvent):
 * 1. Liberar Tanda 1
 * 2. Crear cuadres para cada tanda
 * 3. Crear mini-cuadre
 * 4. Registrar entrada en fondo de recompensas
 * 5. Enviar notificación al vendedor
 */
@CommandHandler(ActivarLoteCommand)
export class ActivarLoteHandler implements ICommandHandler<ActivarLoteCommand, LoteConTandas> {
  private readonly logger = new Logger(ActivarLoteHandler.name);

  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: ILoteRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ActivarLoteCommand): Promise<LoteConTandas> {
    const { loteId, adminId } = command;

    // Buscar el lote
    const lote = await this.loteRepository.findById(loteId);
    if (!lote) {
      throw new DomainException('LOTE_003', 'Lote no encontrado', { loteId });
    }

    // Validar que se puede activar usando la entidad de dominio
    const loteEntity = new LoteEntity({
      ...lote,
      inversionTotal: lote.inversionTotal,
      inversionAdmin: lote.inversionAdmin,
      inversionVendedor: lote.inversionVendedor,
      dineroRecaudado: lote.dineroRecaudado,
      dineroTransferido: lote.dineroTransferido,
    });
    loteEntity.validarActivacion();

    // Activar el lote (esto también libera la primera tanda)
    const loteActivado = await this.loteRepository.activar(loteId);

    this.logger.log(`Lote activado: ${loteId} por admin ${adminId}`);

    // Publicar evento LoteActivadoEvent
    this.eventBus.publish(
      new LoteActivadoEvent(
        loteActivado.id,
        loteActivado.vendedorId,
        loteActivado.cantidadTrabix,
        loteActivado.modeloNegocio,
        loteActivado.tandas.map((t) => ({
          id: t.id,
          numero: t.numero,
          stockInicial: t.stockInicial,
        })),
      ),
    );

    return loteActivado;
  }
}
