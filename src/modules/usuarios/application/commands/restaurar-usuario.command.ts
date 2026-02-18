import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Command para restaurar un usuario eliminado
 */
export class RestaurarUsuarioCommand implements ICommand {
  constructor(
    public readonly usuarioId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando RestaurarUsuario
 * Según sección 1.2: Registro pasa a sección de "eliminados"
 * Este comando permite restaurar un usuario de esa sección
 */
@CommandHandler(RestaurarUsuarioCommand)
export class RestaurarUsuarioHandler implements ICommandHandler<RestaurarUsuarioCommand, Usuario> {
  private readonly logger = new Logger(RestaurarUsuarioHandler.name);

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(command: RestaurarUsuarioCommand): Promise<Usuario> {
    const { usuarioId, adminId } = command;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    // Verificar que está eliminado
    if (!usuario.eliminado) {
      throw new DomainException('USR_008', 'El usuario no está eliminado', {
        usuarioId,
      });
    }

    // Restaurar usuario (quedará en estado INACTIVO)
    const usuarioRestaurado = await this.usuarioRepository.restaurar(usuarioId);

    this.logger.log(`Usuario ${usuarioId} restaurado por admin ${adminId}. Estado: INACTIVO`);

    return usuarioRestaurado;
  }
}
