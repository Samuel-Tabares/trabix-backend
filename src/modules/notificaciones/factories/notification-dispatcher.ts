import { Injectable, Logger } from '@nestjs/common';
import { CanalNotificacion } from '@prisma/client';
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
 * Interface para canales de notificación
 */
export interface INotificationChannel {
  readonly canal: CanalNotificacion;
  send(notificacion: NotificacionEntity): Promise<boolean>;
}

// FIX #5: Eliminado Symbol('NOTIFICACIONES_GATEWAY') huérfano

/**
 * Canal WebSocket
 */
@Injectable()
export class WebSocketChannel implements INotificationChannel {
  private readonly logger = new Logger(WebSocketChannel.name);
  readonly canal: CanalNotificacion = 'WEBSOCKET';

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
 * Canal Push Notification
 * TODO: Implementar integración con Firebase/OneSignal
 */
@Injectable()
export class PushChannel implements INotificationChannel {
  private readonly logger = new Logger(PushChannel.name);
  readonly canal: CanalNotificacion = 'PUSH';

  async send(notificacion: NotificacionEntity): Promise<boolean> {
    try {
      // TODO: Implementar integración con servicio de push (Firebase, OneSignal, etc.)
      this.logger.log(
        `[MOCK] Push notification enviada a ${notificacion.usuarioId}: ${notificacion.titulo}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error enviando Push: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

/**
 * Canal WhatsApp
 * TODO: Implementar integración con WhatsApp Business API
 */
@Injectable()
export class WhatsAppChannel implements INotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);
  readonly canal: CanalNotificacion = 'WHATSAPP';

  async send(notificacion: NotificacionEntity): Promise<boolean> {
    try {
      // TODO: Implementar integración con WhatsApp Business API
      this.logger.log(
        `[MOCK] WhatsApp enviado a ${notificacion.usuarioId}: ${notificacion.titulo}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error enviando WhatsApp: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

/**
 * NotificationDispatcher
 * Despacha notificaciones a múltiples canales
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly channels: Map<CanalNotificacion, INotificationChannel> = new Map();

  constructor(
    private readonly webSocketChannel: WebSocketChannel,
    // TODO (#10): Inyectar y registrar PushChannel y WhatsAppChannel cuando estén implementados.
    // Sin esto, las notificaciones con canal PUSH o WHATSAPP se persisten en DB pero nunca se envían.
    // Pasos:
    //   1. Descomentar los parámetros del constructor.
    //   2. Descomentar las líneas channels.set() correspondientes.
    //   3. Implementar la integración real en PushChannel y WhatsAppChannel.
    //private readonly pushChannel: PushChannel,
    //private readonly whatsAppChannel: WhatsAppChannel,
  ) {
    // Registrar todos los canales disponibles
    this.channels.set('WEBSOCKET', webSocketChannel);
    //this.channels.set('PUSH', pushChannel);
    //this.channels.set('WHATSAPP', whatsAppChannel);

    this.logger.log(`Canales registrados: ${Array.from(this.channels.keys()).join(', ')}`);
  }

  /**
   * Despacha una notificación al canal especificado
   */
  async dispatch(notificacion: NotificacionEntity): Promise<boolean> {
    const channel = this.channels.get(notificacion.canal);

    if (!channel) {
      this.logger.warn(`Canal no encontrado: ${notificacion.canal}`);
      return false;
    }

    return channel.send(notificacion);
  }

  /**
   * Obtiene el canal WebSocket para configuración del gateway
   */
  getWebSocketChannel(): WebSocketChannel {
    return this.webSocketChannel;
  }
}
