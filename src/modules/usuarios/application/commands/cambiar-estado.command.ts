import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Usuario, EstadoUsuario } from '@prisma/client';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { UsuarioEntity } from '../../domain/usuario.entity';

/**
 * Command para cambiar el estado de un usuario
 */
export class CambiarEstadoCommand implements ICommand {
  constructor(
    public readonly usuarioId: string,
    public readonly nuevoEstado: EstadoUsuario,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando CambiarEstado
 * Según sección 1.2 del documento
 *
 * Usuario ACTIVO:
 * - Puede crear lotes
 * - Puede registrar ventas
 * - Puede solicitar equipamiento
 * - Puede participar en cuadres
 * - Aparece en jerarquías
 *
 * Usuario INACTIVO:
 * - No puede crear nuevos lotes
 * - No puede registrar ventas
 * - No puede solicitar equipamiento
 * - Los lotes activos existentes quedan pausados
 * - Sigue apareciendo en jerarquías existentes
 * - Los cuadres pendientes permanecen pendientes
 * - Puede reactivarse por Admin en cualquier momento
 */
@CommandHandler(CambiarEstadoCommand)
export class CambiarEstadoHandler implements ICommandHandler<CambiarEstadoCommand, Usuario> {
  private readonly logger = new Logger(CambiarEstadoHandler.name);

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(command: CambiarEstadoCommand): Promise<Usuario> {
    const { usuarioId, nuevoEstado, adminId } = command;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    // Crear entidad de dominio para validaciones
    const usuarioEntity = new UsuarioEntity(usuario);

    // Validar cambio de estado
    usuarioEntity.validarCambioEstado(nuevoEstado);

    // No se puede cambiar estado del admin
    if (usuario.rol === 'ADMIN') {
      throw new DomainException(
        'USR_006',
        'No se puede cambiar el estado del usuario administrador',
      );
    }

    // Cambiar estado
    const usuarioActualizado = await this.usuarioRepository.cambiarEstado(usuarioId, nuevoEstado);

    this.logger.log(
      `Estado de usuario ${usuarioId} cambiado a ${nuevoEstado} por admin ${adminId}`,
    );

    return usuarioActualizado;
  }
}
