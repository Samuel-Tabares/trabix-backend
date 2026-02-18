import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Infraestructura
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';

// Controllers
import { NotificacionesController } from './controllers';

// Gateways
import { NotificacionesGateway } from './gateways/notificaciones.gateway';

// Domain
import { NOTIFICACION_REPOSITORY } from './domain/notificacion.entity';

// Infrastructure
import { PrismaNotificacionRepository } from './infrastructure';

// Factories
import { NotificationContentFactory } from './factories/notification-content.factory';
import {
  NotificationDispatcher,
  WebSocketChannel,
  PushChannel,
  WhatsAppChannel,
} from './factories/notification-dispatcher';

// Application
import { NotificacionCommandHandlers } from './application/commands';
import { NotificacionQueryHandlers } from './application/queries';

/**
 * Gestiona:
 * - Envío de notificaciones (Factory Pattern)
 * - Despacho multicanal (WebSocket, Push, WhatsApp)
 * - WebSocket Gateway para tiempo real
 * - Listado y marcado de notificaciones
 */
@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiresIn'),
        },
      }),
    }),
  ],
  controllers: [NotificacionesController],
  providers: [
    {
      provide: NOTIFICACION_REPOSITORY,
      useClass: PrismaNotificacionRepository,
    },
    // Gateway
    NotificacionesGateway,
    // Canales
    WebSocketChannel,
    PushChannel,
    WhatsAppChannel,
    // Factory + Dispatcher
    NotificationContentFactory,
    NotificationDispatcher,
    // CQRS
    ...NotificacionCommandHandlers,
    ...NotificacionQueryHandlers,
  ],
  exports: [NOTIFICACION_REPOSITORY, NotificationContentFactory, NotificationDispatcher],
})
export class NotificacionesModule implements OnModuleInit {
  constructor(
    private readonly gateway: NotificacionesGateway,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.dispatcher.getWebSocketChannel().setGateway(this.gateway);
  }
}
