import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { INotificacionRepository, NOTIFICACION_REPOSITORY } from '../../domain/notificacion.entity';
import { QueryNotificacionesDto, NotificacionesPaginadasDto } from '../dto';

// ========== ListarMisNotificacionesQuery ==========

export class ListarMisNotificacionesQuery implements IQuery {
  constructor(
    public readonly usuarioId: string,
    public readonly filtros: QueryNotificacionesDto,
  ) {}
}

@QueryHandler(ListarMisNotificacionesQuery)
export class ListarMisNotificacionesHandler implements IQueryHandler<
  ListarMisNotificacionesQuery,
  NotificacionesPaginadasDto
> {
  constructor(
    @Inject(NOTIFICACION_REPOSITORY)
    private readonly notificacionRepository: INotificacionRepository,
  ) {}

  async execute(query: ListarMisNotificacionesQuery): Promise<NotificacionesPaginadasDto> {
    const resultado = await this.notificacionRepository.findByUsuarioId({
      usuarioId: query.usuarioId,
      skip: query.filtros.skip,
      take: query.filtros.take,
      soloNoLeidas: query.filtros.soloNoLeidas,
      tipo: query.filtros.tipo,
    });

    return {
      data: resultado.data.map((n) => ({
        id: n.id,
        usuarioId: n.usuarioId,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        datos: n.datos,
        canal: n.canal,
        leida: n.leida,
        fechaCreacion: n.fechaCreacion,
        fechaLeida: n.fechaLeida,
      })),
      total: resultado.total,
      noLeidas: resultado.noLeidas,
      hasMore: resultado.hasMore,
    };
  }
}

// ========== ContarNoLeidasQuery ==========

export class ContarNoLeidasQuery implements IQuery {
  constructor(public readonly usuarioId: string) {}
}

@QueryHandler(ContarNoLeidasQuery)
export class ContarNoLeidasHandler implements IQueryHandler<ContarNoLeidasQuery, number> {
  constructor(
    @Inject(NOTIFICACION_REPOSITORY)
    private readonly notificacionRepository: INotificacionRepository,
  ) {}

  async execute(query: ContarNoLeidasQuery): Promise<number> {
    return this.notificacionRepository.contarNoLeidas(query.usuarioId);
  }
}

// ========== ObtenerNotificacionQuery ==========

export class ObtenerNotificacionQuery implements IQuery {
  constructor(
    public readonly notificacionId: string,
    public readonly usuarioId: string,
  ) {}
}

@QueryHandler(ObtenerNotificacionQuery)
export class ObtenerNotificacionHandler implements IQueryHandler<ObtenerNotificacionQuery> {
  constructor(
    @Inject(NOTIFICACION_REPOSITORY)
    private readonly notificacionRepository: INotificacionRepository,
  ) {}

  async execute(query: ObtenerNotificacionQuery) {
    const notificacion = await this.notificacionRepository.findById(query.notificacionId);

    if (!notificacion) {
      return null;
    }

    // Verificar que pertenece al usuario
    if (notificacion.usuarioId !== query.usuarioId) {
      return null;
    }

    return {
      id: notificacion.id,
      usuarioId: notificacion.usuarioId,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      datos: notificacion.datos,
      canal: notificacion.canal,
      leida: notificacion.leida,
      fechaCreacion: notificacion.fechaCreacion,
      fechaLeida: notificacion.fechaLeida,
    };
  }
}

// Export handlers array
export const NotificacionQueryHandlers = [
  ListarMisNotificacionesHandler,
  ContarNoLeidasHandler,
  ObtenerNotificacionHandler,
];
