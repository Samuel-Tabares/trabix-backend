import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Interfaz para eventos del dominio
 */
export interface DomainEvent {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * EventStore Service
 * Según sección 23 del documento: Persistencia de eventos para auditoría
 *
 * Responsabilidades:
 * - Persistir todos los eventos del dominio
 * - Proveer consultas para auditoría y replay
 */
@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste un evento en el EventStore
   */
  async persist(event: DomainEvent): Promise<void> {
    try {
      await this.prisma.eventStore.create({
        data: {
          eventName: event.eventName,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
          metadata: event.metadata || {},
        },
      });

      this.logger.debug(
        `Evento persistido: ${event.eventName} - ${event.aggregateType}:${event.aggregateId}`,
      );
    } catch (error) {
      this.logger.error(`Error persistiendo evento: ${event.eventName}`, error);
      throw error;
    }
  }
}
