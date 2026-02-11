import { CommandHandler, ICommandHandler, ICommand, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  ICuadreRepository,
  CUADRE_REPOSITORY,
} from '../../domain/cuadre.repository.interface';
import { CuadreEntity } from '../../domain/cuadre.entity';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { EnviarNotificacionCommand } from '../../../notificaciones/application/commands';

/**
 * Command para activar un cuadre (INACTIVO → PENDIENTE)
 * Se ejecuta cuando se cumple el trigger
 */
export class ActivarCuadreCommand implements ICommand {
  constructor(public readonly cuadreId: string) {}
}

/**
 * Handler del comando ActivarCuadre
 * Según sección 17.6 del documento
 *
 * Validaciones:
 * - Cuadre existe y está INACTIVO
 * - Trigger cumplido (verificado antes de llamar al comando)
 */
@CommandHandler(ActivarCuadreCommand)
export class ActivarCuadreHandler
  implements ICommandHandler<ActivarCuadreCommand>
{
  private readonly logger = new Logger(ActivarCuadreHandler.name);

  constructor(
    @Inject(CUADRE_REPOSITORY)
    private readonly cuadreRepository: ICuadreRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ActivarCuadreCommand): Promise<any> {
    const { cuadreId } = command;

    // Buscar el cuadre
    const cuadre = await this.cuadreRepository.findById(cuadreId);
    if (!cuadre) {
      throw new DomainException(
        'CUA_001',
        'Cuadre no encontrado',
        { cuadreId },
      );
    }

    // Crear entidad de dominio para validaciones
    const cuadreEntity = new CuadreEntity({
      ...cuadre,
      montoEsperado: cuadre.montoEsperado,
      montoRecibido: cuadre.montoRecibido,
      montoFaltante: cuadre.montoFaltante,
      montoCubiertoPorMayor: cuadre.montoCubiertoPorMayor,
    });

    // Validar que se puede activar
    cuadreEntity.validarActivacion();

    // Activar el cuadre
    const cuadreActivado = await this.cuadreRepository.activar(cuadreId);

    this.logger.log(
      `Cuadre activado: ${cuadreId} - Tanda ${cuadre.tanda.numero} - Lote ${cuadre.tanda.loteId}`,
    );

    try {
      const vendedorId = cuadre.tanda.lote?.vendedorId;
      if (vendedorId) {
        await this.commandBus.execute(
          new EnviarNotificacionCommand(
            vendedorId,
            'CUADRE_PENDIENTE',
            {
              cuadreId: cuadreId,
              tandaId: cuadre.tandaId,
              numeroTanda: cuadre.tanda.numero,
              montoEsperado: Number.parseFloat(cuadre.montoEsperado.toString()),
            },
          ),
        );
      } else {
        this.logger.warn(
          `No se pudo enviar notificación CUADRE_PENDIENTE: vendedorId no encontrado para cuadre ${cuadreId}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Error enviando notificación CUADRE_PENDIENTE para cuadre ${cuadreId}: ${error}`,
      );
    }

    return cuadreActivado;
  }
}