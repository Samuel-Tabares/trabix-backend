import { Injectable, Logger } from '@nestjs/common';
import { NotificacionEntity } from '../domain/notificacion.entity';

/**
 * Datos de notificación para envío
 */
export interface NotificacionPayload {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown> | null;
  fechaCreacion: Date;
}

/**
 * Interface para el gateway de WebSocket
 */
export interface INotificacionesGateway {
  enviarNotificacion(usuarioId: string, payload: NotificacionPayload): void;
}

/**
 * Canal WebSocket — único canal activo actualmente.
 * Envía notificaciones en tiempo real vía socket.io.
 */
@Injectable()
export class WebSocketChannel {
  private readonly logger = new Logger(WebSocketChannel.name);

  private gateway: INotificacionesGateway | null = null;

  setGateway(gateway: INotificacionesGateway): void {
    this.gateway = gateway;
  }

  async send(notificacion: NotificacionEntity): Promise<boolean> {
    try {
      if (this.gateway) {
        this.gateway.enviarNotificacion(notificacion.usuarioId, {
          id: notificacion.id,
          tipo: notificacion.tipo,
          titulo: notificacion.titulo,
          mensaje: notificacion.mensaje,
          datos: notificacion.datos,
          fechaCreacion: notificacion.fechaCreacion,
        });
        this.logger.log(`WebSocket enviado a ${notificacion.usuarioId}`);
        return true;
      }
      this.logger.warn('Gateway no configurado para WebSocket');
      return false;
    } catch (error) {
      this.logger.error(
        `Error enviando WebSocket: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

/**
 * NotificationDispatcher
 *
 * Actualmente solo gestiona el canal WebSocket.
 * En el futuro se pueden agregar canales adicionales aquí:
 *   - PUSH: Firebase Cloud Messaging / OneSignal
 *   - EMAIL: SMTP / SendGrid / Resend
 *   - WHATSAPP: WhatsApp Business API
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(private readonly webSocketChannel: WebSocketChannel) {}

  /**
   * Despacha una notificación por WebSocket
   */
  async dispatch(notificacion: NotificacionEntity): Promise<boolean> {
    const enviado = await this.webSocketChannel.send(notificacion);

    if (!enviado) {
      this.logger.warn(`No se pudo enviar notificación ${notificacion.id} por WebSocket`);
    }

    return enviado;
  }

  /**
   * Obtiene el canal WebSocket para configuración del gateway
   */
  getWebSocketChannel(): WebSocketChannel {
    return this.webSocketChannel;
  }
}
