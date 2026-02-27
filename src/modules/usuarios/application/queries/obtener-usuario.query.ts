import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IUsuarioRepository, USUARIO_REPOSITORY } from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import { UsuarioResponseDto, UsuarioBasicoDto } from '../dto/usuario-response.dto';

/**
 * Query para obtener un usuario por ID
 */
export class ObtenerUsuarioQuery implements IQuery {
  constructor(
    public readonly usuarioId: string,
    public readonly includeReclutador: boolean = true,
  ) {}
}

/**
 * Handler de la query ObtenerUsuario
 */
@QueryHandler(ObtenerUsuarioQuery)
export class ObtenerUsuarioHandler implements IQueryHandler<
  ObtenerUsuarioQuery,
  UsuarioResponseDto
> {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(query: ObtenerUsuarioQuery): Promise<UsuarioResponseDto> {
    const { usuarioId, includeReclutador } = query;

    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    if (usuario.eliminado) {
      throw new DomainException('USR_001', 'Usuario no encontrado', {
        usuarioId,
      });
    }

    // Obtener reclutador si es necesario
    let reclutador: UsuarioBasicoDto | null = null;

    if (includeReclutador && usuario.reclutadorId) {
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
      bloqueadoHasta: usuario.bloqueadoHasta,
      // Usar campo persistido en vez de calcular
      modeloNegocio: usuario.modeloNegocio === 'MODELO_60_40' ? '60_40' : '50_50',
    };
  }
}
