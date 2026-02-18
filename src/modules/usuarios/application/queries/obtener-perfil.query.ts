import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { UsuarioResponseDto, UsuarioBasicoDto } from '../dto/usuario-response.dto';
import { DomainException } from '../../../../domain/exceptions/domain.exception';

/**
 * Query para obtener el perfil propio del usuario autenticado
 */
export class ObtenerPerfilQuery implements IQuery {
  constructor(public readonly usuarioId: string) {}
}

/**
 * Handler de la query ObtenerPerfil
 * Endpoint: GET /usuarios/me
 */
@QueryHandler(ObtenerPerfilQuery)
export class ObtenerPerfilHandler implements IQueryHandler<ObtenerPerfilQuery, UsuarioResponseDto> {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(query: ObtenerPerfilQuery): Promise<UsuarioResponseDto> {
    const { usuarioId } = query;

    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    // Obtener reclutador
    let reclutador: UsuarioBasicoDto | null = null;

    if (usuario.reclutadorId) {
      const reclutadorData = await this.usuarioRepository.findById(usuario.reclutadorId);
      if (reclutadorData) {
        reclutador = {
          id: reclutadorData.id,
          nombre: reclutadorData.nombre,
          apellidos: reclutadorData.apellidos,
          nombreCompleto: `${reclutadorData.nombre} ${reclutadorData.apellidos}`,
          email: reclutadorData.email,
          rol: reclutadorData.rol,
        };
      }
    }

    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      nombreCompleto: `${usuario.nombre} ${usuario.apellidos}`,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol,
      estado: usuario.estado,
      requiereCambioPassword: usuario.requiereCambioPassword,
      reclutadorId: usuario.reclutadorId,
      reclutador,
      fechaCreacion: usuario.fechaCreacion,
      ultimoLogin: usuario.ultimoLogin,
      fechaCambioEstado: usuario.fechaCambioEstado,
      // Usar campo persistido en vez de calcular
      modeloNegocio: usuario.modeloNegocio === 'MODELO_60_40' ? '60_40' : '50_50',
    };
  }
}
