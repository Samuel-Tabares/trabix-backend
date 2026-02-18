import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { UpdateUsuarioDto } from '../dto/update-usuario.dto';

/**
 * Command para actualizar un usuario
 */
export class ActualizarUsuarioCommand implements ICommand {
  constructor(
    public readonly usuarioId: string,
    public readonly data: UpdateUsuarioDto,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando ActualizarUsuario
 */
@CommandHandler(ActualizarUsuarioCommand)
export class ActualizarUsuarioHandler implements ICommandHandler<
  ActualizarUsuarioCommand,
  Usuario
> {
  private readonly logger = new Logger(ActualizarUsuarioHandler.name);

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(command: ActualizarUsuarioCommand): Promise<Usuario> {
    const { usuarioId, data, adminId } = command;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    if (usuario.eliminado) {
      throw new DomainException('USR_001', 'No se puede actualizar un usuario eliminado', {
        usuarioId,
      });
    }

    // Validar email único si se está actualizando
    if (data.email && data.email.toLowerCase() !== usuario.email.toLowerCase()) {
      const existeEmail = await this.usuarioRepository.existsByEmail(data.email, usuarioId);
      if (existeEmail) {
        throw new DomainException('USR_003', 'Ya existe un usuario con este correo electrónico', {
          email: data.email,
        });
      }
    }

    // Validar teléfono único si se está actualizando
    if (data.telefono && data.telefono !== usuario.telefono) {
      const existeTelefono = await this.usuarioRepository.existsByTelefono(
        data.telefono,
        usuarioId,
      );
      if (existeTelefono) {
        throw new DomainException('USR_004', 'Ya existe un usuario con este número de teléfono', {
          telefono: data.telefono,
        });
      }
    }

    // Actualizar usuario
    const usuarioActualizado = await this.usuarioRepository.update(usuarioId, {
      nombre: data.nombre?.trim(),
      apellidos: data.apellidos?.trim(),
      email: data.email?.toLowerCase().trim(),
      telefono: data.telefono?.replaceAll(/\s/g, ''),
    });

    this.logger.log(`Usuario ${usuarioId} actualizado por admin ${adminId}`);

    return usuarioActualizado;
  }
}
