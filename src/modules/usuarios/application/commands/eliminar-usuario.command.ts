import { CommandHandler, ICommandHandler, ICommand } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { UsuarioEntity } from '../../domain/usuario.entity';

/**
 * Command para eliminar un usuario (soft delete)
 */
export class EliminarUsuarioCommand implements ICommand {
  constructor(
    public readonly usuarioId: string,
    public readonly adminId: string,
  ) {}
}

/**
 * Handler del comando EliminarUsuario
 * Según sección 1.2:
 * - Un usuario puede ser eliminado por admin
 * - Solo si NO tiene reclutados (jerarquía inferior)
 * - No elimina registro histórico relacionado
 * - Registro pasa a sección de "eliminados"
 */
@CommandHandler(EliminarUsuarioCommand)
export class EliminarUsuarioHandler implements ICommandHandler<EliminarUsuarioCommand, Usuario> {
  private readonly logger = new Logger(EliminarUsuarioHandler.name);

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(command: EliminarUsuarioCommand): Promise<Usuario> {
    const { usuarioId, adminId } = command;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    // Crear entidad de dominio para validaciones
    const usuarioEntity = new UsuarioEntity(usuario);

    // Validar que puede ser eliminado
    usuarioEntity.validarEliminacion();

    // Verificar que NO tenga reclutados (jerarquía inferior)
    const reclutados = await this.usuarioRepository.findReclutados(usuarioId);
    const reclutadosActivos = reclutados.filter((r) => !r.eliminado);

    if (reclutadosActivos.length > 0) {
      throw new DomainException(
        'USR_007',
        'No se puede eliminar un usuario que tiene reclutados activos. ' +
          'Primero debe eliminar o reasignar a sus reclutados.',
        {
          usuarioId,
          cantidadReclutados: reclutadosActivos.length,
          reclutados: reclutadosActivos.map((r) => ({
            id: r.id,
            nombre: `${r.nombre} ${r.apellidos}`,
          })),
        },
      );
    }

    // Eliminar usuario (soft delete)
    const usuarioEliminado = await this.usuarioRepository.softDelete(usuarioId);

    this.logger.log(`Usuario ${usuarioId} eliminado por admin ${adminId}`);

    return usuarioEliminado;
  }
}
