import { TipoNotificacion, CanalNotificacion } from '@prisma/client';
import { DomainException } from '../../../domain/exceptions/domain.exception';

/**
 * Entidad de dominio Notificacion
 * Según sección 15 del documento
 */
export class NotificacionEntity {
  readonly id: string;
  readonly usuarioId: string;
  readonly tipo: TipoNotificacion;
  readonly titulo: string;
  readonly mensaje: string;
  readonly datos: Record<string, unknown> | null;
  readonly canal: CanalNotificacion;
  readonly leida: boolean;
  readonly fechaCreacion: Date;
  readonly fechaLeida: Date | null;

  constructor(props: NotificacionEntityProps) {
    this.id = props.id;
    this.usuarioId = props.usuarioId;
    this.tipo = props.tipo;
    this.titulo = props.titulo;
    this.mensaje = props.mensaje;
    this.datos = props.datos;
    this.canal = props.canal;
    this.leida = props.leida;
    this.fechaCreacion = props.fechaCreacion;
    this.fechaLeida = props.fechaLeida;
  }

  /**
   * Valida que se puede marcar como leída
   */
  validarMarcarLeida(): void {
    if (this.leida) {
      throw new DomainException('NOT_001', 'La notificación ya está marcada como leída');
    }
  }
}

/**
 * Props para crear una notificación
 */
export interface NotificacionEntityProps {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown> | null;
  canal: CanalNotificacion;
  leida: boolean;
  fechaCreacion: Date;
  fechaLeida: Date | null;
}

/**
 * Datos para crear una notificación
 */
export interface CreateNotificacionData {
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  datos?: Record<string, unknown>;
  canal?: CanalNotificacion;
}

/**
 * Opciones para listar notificaciones
 */
export interface FindNotificacionesOptions {
  usuarioId: string;
  skip?: number;
  take?: number;
  soloNoLeidas?: boolean;
  tipo?: TipoNotificacion;
}

/**
 * Resultado paginado
 */
export interface PaginatedNotificaciones {
  data: NotificacionEntity[];
  total: number;
  noLeidas: number;
  hasMore: boolean;
}

/**
 * Interface del repositorio de notificaciones
 */
export interface INotificacionRepository {
  findById(id: string): Promise<NotificacionEntity | null>;
  findByUsuarioId(options: FindNotificacionesOptions): Promise<PaginatedNotificaciones>;
  create(data: CreateNotificacionData): Promise<NotificacionEntity>;
  marcarComoLeida(id: string): Promise<NotificacionEntity>;
  marcarTodasComoLeidas(usuarioId: string, tipo?: TipoNotificacion): Promise<number>;
  contarNoLeidas(usuarioId: string): Promise<number>;
}

export const NOTIFICACION_REPOSITORY = Symbol('NOTIFICACION_REPOSITORY');
