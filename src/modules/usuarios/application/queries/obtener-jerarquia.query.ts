import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import {
  IUsuarioRepository,
  USUARIO_REPOSITORY,
  UsuarioJerarquiaConGanancias,
} from '../../domain/usuario.repository.interface';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import {
  UsuarioJerarquiaDto,
  UsuarioBasicoDto,
  ResumenGananciasDto,
} from '../dto/usuario-response.dto';

/**
 * Query para obtener la jerarquía de un usuario
 * Incluye validación de permisos según rol
 */
export class ObtenerJerarquiaQuery implements IQuery {
  constructor(
    public readonly usuarioId: string,
    public readonly solicitanteId: string,
    public readonly solicitanteRol: Rol,
  ) {}
}

/**
 * Handler de la query ObtenerJerarquia
 *
 * Reglas de acceso:
 * - ADMIN: puede ver cualquier jerarquía
 * - RECLUTADOR: puede ver SU PROPIA jerarquía (su rama completa con ganancias)
 * - VENDEDOR: NO puede ver jerarquía (no tiene rama)
 *
 * Según sección 2.1 del documento:
 * - Nivel N: comprador del lote
 * - Nivel N-1: reclutador directo
 * - Nivel N-2: reclutador del reclutador
 * - ... hasta ADMIN
 */
@QueryHandler(ObtenerJerarquiaQuery)
export class ObtenerJerarquiaHandler implements IQueryHandler<
  ObtenerJerarquiaQuery,
  UsuarioJerarquiaDto
> {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  async execute(query: ObtenerJerarquiaQuery): Promise<UsuarioJerarquiaDto> {
    const { usuarioId, solicitanteId, solicitanteRol } = query;

    // Verificar que el usuario objetivo existe
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

    // Validar permisos según rol del solicitante
    await this.validarPermisos(usuarioId, solicitanteId, solicitanteRol, usuario.rol);

    // Obtener la jerarquía con ganancias (para transparencia)
    const jerarquia = await this.usuarioRepository.findJerarquiaConGanancias(usuarioId);

    // Mapear a DTO
    return this.mapJerarquiaToDto(jerarquia);
  }

  /**
   * Valida los permisos de acceso a la jerarquía
   */
  private async validarPermisos(
    usuarioObjetivoId: string,
    solicitanteId: string,
    solicitanteRol: Rol,
    usuarioObjetivoRol: Rol,
  ): Promise<void> {
    // ADMIN puede ver cualquier jerarquía
    if (solicitanteRol === 'ADMIN') {
      return;
    }

    // VENDEDOR no puede ver jerarquías (no tiene rama)
    if (solicitanteRol === 'VENDEDOR') {
      throw new ForbiddenException(
        'Los vendedores no tienen acceso a jerarquías. Solo los reclutadores pueden ver su rama.',
      );
    }

    // RECLUTADOR solo puede ver SU PROPIA jerarquía
    if (solicitanteRol === 'RECLUTADOR') {
      // Debe ser su propia jerarquía
      if (solicitanteId !== usuarioObjetivoId) {
        throw new ForbiddenException(
          'Solo puede ver su propia jerarquía. Acceda a /usuarios/:suId/jerarquia',
        );
      }

      // El usuario objetivo (él mismo) debe ser RECLUTADOR
      if (usuarioObjetivoRol !== 'RECLUTADOR') {
        throw new ForbiddenException(
          'Su cuenta no tiene rol de reclutador. No tiene rama de reclutados.',
        );
      }

      return;
    }

    // Cualquier otro caso, denegar
    throw new ForbiddenException('No tiene permisos para ver esta jerarquía');
  }

  /**
   * Mapea la estructura de jerarquía del repositorio al DTO
   * Incluye ganancias para transparencia
   */
  private mapJerarquiaToDto(jerarquia: UsuarioJerarquiaConGanancias): UsuarioJerarquiaDto {
    const usuarioBasico: UsuarioBasicoDto = {
      id: jerarquia.usuario.id,
      nombre: jerarquia.usuario.nombre,
      apellidos: jerarquia.usuario.apellidos,
      nombreCompleto: `${jerarquia.usuario.nombre} ${jerarquia.usuario.apellidos}`,
      email: jerarquia.usuario.email,
      rol: jerarquia.usuario.rol,
    };

    const ganancias: ResumenGananciasDto = {
      totalVentas: jerarquia.ganancias.totalVentas,
      trabixVendidos: jerarquia.ganancias.trabixVendidos,
      ingresosBrutos: jerarquia.ganancias.ingresosBrutos,
      gananciasVendedor: jerarquia.ganancias.gananciasVendedor,
      lotesActivos: jerarquia.ganancias.lotesActivos,
      lotesFinalizados: jerarquia.ganancias.lotesFinalizados,
    };

    return {
      usuario: usuarioBasico,
      ganancias,
      reclutados: jerarquia.reclutados.map((r) => this.mapJerarquiaToDto(r)),
      totalReclutados: jerarquia.totalReclutados,
      nivel: jerarquia.nivel,
    };
  }
}
