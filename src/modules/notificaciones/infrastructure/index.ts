import { Injectable } from '@nestjs/common';
import { TipoNotificacion, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  INotificacionRepository,
  NotificacionEntity,
  CreateNotificacionData,
  FindNotificacionesOptions,
  PaginatedNotificaciones,
} from '../domain/notificacion.entity';

@Injectable()
export class PrismaNotificacionRepository implements INotificacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<NotificacionEntity | null> {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id },
    });

    if (!notificacion) return null;

    return this.mapToEntity(notificacion);
  }

  async findByUsuarioId(
    options: FindNotificacionesOptions,
  ): Promise<PaginatedNotificaciones> {
    const {
      usuarioId,
      skip = 0,
      take = 20,
      soloNoLeidas = false,
      tipo,                    // FIX #2: extraer tipo de las opciones
    } = options;

    const where: Prisma.NotificacionWhereInput = {
      usuarioId,
      ...(soloNoLeidas ? { leida: false } : {}),
      ...(tipo ? { tipo } : {}),  // FIX #2: aplicar filtro por tipo
    };

    const [data, total, noLeidas] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        skip,
        take: take + 1, // +1 para detectar hasMore
        orderBy: { fechaCreacion: 'desc' },
      }),
      this.prisma.notificacion.count({ where }),
      this.prisma.notificacion.count({
        where: { usuarioId, leida: false },
      }),
    ]);

    const hasMore = data.length > take;
    if (hasMore) data.pop();

    return {
      data: data.map((n) => this.mapToEntity(n)),
      total,
      noLeidas,
      hasMore,
    };
  }

  async create(data: CreateNotificacionData): Promise<NotificacionEntity> {
    const notificacion = await this.prisma.notificacion.create({
      data: {
        usuarioId: data.usuarioId,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        datos: (data.datos as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        canal: data.canal || 'WEBSOCKET',
      },
    });

    return this.mapToEntity(notificacion);
  }

  async marcarComoLeida(id: string): Promise<NotificacionEntity> {
    const notificacion = await this.prisma.notificacion.update({
      where: { id },
      data: {
        leida: true,
        fechaLeida: new Date(),
      },
    });

    return this.mapToEntity(notificacion);
  }

  async marcarTodasComoLeidas(
    usuarioId: string,
    tipo?: TipoNotificacion,
  ): Promise<number> {
    const where: Prisma.NotificacionWhereInput = {
      usuarioId,
      leida: false,
      ...(tipo ? { tipo } : {}),
    };

    const result = await this.prisma.notificacion.updateMany({
      where,
      data: {
        leida: true,
        fechaLeida: new Date(),
      },
    });

    return result.count;
  }

  async contarNoLeidas(usuarioId: string): Promise<number> {
    return this.prisma.notificacion.count({
      where: { usuarioId, leida: false },
    });
  }

  /**
   * Mapea un registro de Prisma a la entidad de dominio
   */
  private mapToEntity(
    notificacion: Prisma.NotificacionGetPayload<object>,
  ): NotificacionEntity {
    return new NotificacionEntity({
      id: notificacion.id,
      usuarioId: notificacion.usuarioId,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      datos: notificacion.datos as Record<string, unknown> | null,
      canal: notificacion.canal,
      leida: notificacion.leida,
      fechaCreacion: notificacion.fechaCreacion,
      fechaLeida: notificacion.fechaLeida,
    });
  }
}