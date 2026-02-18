import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificacionPayload, INotificacionesGateway } from '../factories/notification-dispatcher';

/**
 * Payload de autenticación WebSocket
 */
interface AuthPayload {
  token: string;
}

/**
 * Payload del JWT decodificado
 */
interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  iat?: number;
  exp?: number;
}

/**
 * Usuario conectado
 */
interface ConnectedUser {
  socketId: string;
  usuarioId: string;
  connectedAt: Date;
}

/**
 * Respuesta de suscripción
 */
interface SubscribeResponse {
  success: boolean;
  message: string;
}

/**
 * Respuesta de marcar leída
 */
interface MarcarLeidaResponse {
  success: boolean;
  notificacionId?: string;
}

/**
 * WebSocket Gateway para Notificaciones
 * Según sección 24 del documento
 *
 * Gateway: /ws/notificaciones
 *
 * Eventos que emite el servidor:
 * - nueva-notificacion
 * - stock-actualizado
 * - cuadre-pendiente
 * - tanda-liberada
 *
 * Eventos que recibe el servidor:
 * - subscribir (con JWT)
 * - marcar-leida
 */
@Injectable()
@WebSocketGateway({
  namespace: '/ws/notificaciones',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
})
export class NotificacionesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, INotificacionesGateway
{
  private readonly logger = new Logger(NotificacionesGateway.name);
  private readonly connectedUsers: Map<string, ConnectedUser> = new Map();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Inicialización del gateway
   */
  afterInit(): void {
    const corsOrigin = this.configService.get<string>('security.corsOrigin');
    this.logger.log(`WebSocket Gateway inicializado. CORS origin: ${corsOrigin}`);
  }

  /**
   * Maneja nueva conexión
   */
  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Cliente conectado: ${client.id}`);

    try {
      // Intentar autenticar desde handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        await this.authenticateClient(client, token);
      } else {
        this.logger.debug(`Cliente ${client.id} conectado sin autenticación inicial`);
      }
    } catch (error) {
      this.logger.warn(
        `Error en conexión inicial: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Maneja desconexión
   */
  handleDisconnect(client: Socket): void {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.logger.log(`Usuario ${user.usuarioId} desconectado (socket: ${client.id})`);
    }
    this.connectedUsers.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  /**
   * Suscribe un cliente a notificaciones (con JWT)
   */
  @SubscribeMessage('subscribir')
  async handleSubscribir(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AuthPayload,
  ): Promise<SubscribeResponse> {
    try {
      if (!data?.token) {
        return { success: false, message: 'Token no proporcionado' };
      }

      await this.authenticateClient(client, data.token);
      return { success: true, message: 'Suscrito exitosamente' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error de autenticación',
      };
    }
  }

  /**
   * Marca una notificación como leída
   */
  @SubscribeMessage('marcar-leida')
  async handleMarcarLeida(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificacionId: string },
  ): Promise<MarcarLeidaResponse> {
    const user = this.connectedUsers.get(client.id);
    if (!user) {
      return { success: false };
    }

    if (!data?.notificacionId) {
      return { success: false };
    }

    // El comando de marcar leída se ejecutará desde el controller
    // Aquí solo confirmamos la recepción
    this.logger.log(`Notificación ${data.notificacionId} marcada como leída por ${user.usuarioId}`);
    return { success: true, notificacionId: data.notificacionId };
  }

  /**
   * Autentica un cliente con JWT
   */
  private async authenticateClient(client: Socket, token: string): Promise<void> {
    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      if (!secret) {
        throw new Error('JWT secret no configurado');
      }

      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      if (!payload.sub) {
        throw new UnauthorizedException('Token inválido: falta subject');
      }

      // Verificar si ya existe una conexión para este usuario
      const existingConnection = Array.from(this.connectedUsers.values()).find(
        (u) => u.usuarioId === payload.sub,
      );

      if (existingConnection && existingConnection.socketId !== client.id) {
        this.logger.debug(
          `Usuario ${payload.sub} ya tiene conexión activa en ${existingConnection.socketId}`,
        );
      }

      this.connectedUsers.set(client.id, {
        socketId: client.id,
        usuarioId: payload.sub,
        connectedAt: new Date(),
      });

      // Unir al room del usuario
      await client.join(`user:${payload.sub}`);

      this.logger.log(`Usuario ${payload.sub} autenticado en socket ${client.id}`);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        `Token inválido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  }

  // ========== Métodos para emitir eventos ==========

  /**
   * Envía una notificación a un usuario específico
   */
  enviarNotificacion(usuarioId: string, notificacion: NotificacionPayload): void {
    this.server.to(`user:${usuarioId}`).emit('nueva-notificacion', notificacion);
    this.logger.log(`Notificación enviada a usuario ${usuarioId}`);
  }

  /**
   * Envía evento de stock actualizado
   */
  enviarStockActualizado(
    usuarioId: string,
    data: { stockActual: number; porcentaje: number },
  ): void {
    this.server.to(`user:${usuarioId}`).emit('stock-actualizado', data);
    this.logger.log(`Stock actualizado enviado a usuario ${usuarioId}`);
  }

  /**
   * Envía evento de cuadre pendiente
   */
  enviarCuadrePendiente(
    usuarioId: string,
    data: { cuadreId: string; montoEsperado: number },
  ): void {
    this.server.to(`user:${usuarioId}`).emit('cuadre-pendiente', data);
    this.logger.log(`Cuadre pendiente enviado a usuario ${usuarioId}`);
  }

  /**
   * Envía evento de tanda liberada
   */
  enviarTandaLiberada(
    usuarioId: string,
    data: { tandaId: string; numeroTanda: number; cantidad: number },
  ): void {
    this.server.to(`user:${usuarioId}`).emit('tanda-liberada', data);
    this.logger.log(`Tanda liberada enviada a usuario ${usuarioId}`);
  }

  /**
   * Broadcast a todos los usuarios conectados (solo admin)
   */
  broadcast(evento: string, data: unknown): void {
    this.server.emit(evento, data);
    this.logger.log(`Broadcast enviado: ${evento}`);
  }
}
