import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';
import { OutboxService } from './outbox.service';
import { EventStoreService, DomainEvent } from '../event-store/event-store.service';

/**
 * Mapeo de tipos de evento a clases de evento
 * Se debe extender según los eventos del dominio
 */
const EVENT_MAPPINGS: Record<string, any> = {
  // Los eventos se registran dinámicamente o se mapean aquí
};

/**
 * Outbox Processor
 * Según sección 23 del documento: Outbox Processor con Bull
 *
 * Responsabilidades:
 * 1. Lee eventos pendientes del outbox
 * 2. Publica eventos en el EventBus
 * 3. Persiste eventos en EventStore para auditoría
 * 4. Maneja reintentos con backoff exponencial
 *
 * GARANTÍAS:
 * - At-least-once delivery
 * - Backoff exponencial: 1s, 2s, 4s (máx 3 reintentos)
 */
@Injectable()
export class OutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isProcessing = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly eventStoreService: EventStoreService,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit() {
    this.logger.log('OutboxProcessor inicializado');
  }

  /**
   * Procesa eventos pendientes cada 5 segundos
   */
  @Cron('*/5 * * * * *') // Cada 5 segundos
  async processOutbox(): Promise<void> {
    // Evitar procesamiento concurrente
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingMessages = await this.outboxService.getPendingMessages(50);

      if (pendingMessages.length === 0) {
        return;
      }

      this.logger.debug(`Procesando ${pendingMessages.length} mensajes del outbox`);

      for (const message of pendingMessages) {
        await this.processMessage(message);
      }
    } catch (error) {
      this.logger.error('Error procesando outbox', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Procesa un mensaje individual del outbox
   */
  private async processMessage(message: any): Promise<void> {
    try {
      const { id, eventType, payload } = message;

      // 1. Publicar evento en EventBus (si hay handler registrado)
      await this.publishEvent(eventType, payload);

      // 2. Persistir en EventStore para auditoría
      const domainEvent: DomainEvent = {
        eventName: eventType,
        aggregateType: payload.aggregateType || 'Unknown',
        aggregateId: payload.aggregateId || payload.id || 'unknown',
        payload,
        metadata: {
          outboxId: id,
          processedAt: new Date().toISOString(),
        },
      };
      await this.eventStoreService.persist(domainEvent);

      // 3. Marcar como procesado
      await this.outboxService.markAsProcessed(id);

      this.logger.debug(`Evento procesado: ${eventType} (${id})`);
    } catch (error: unknown) {
      // Narrowing del error unknown para acceder de forma segura al mensaje
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log del error con mensaje seguro
      this.logger.error(`Error procesando mensaje ${message.id}: ${errorMessage}`);

      // Aplicar backoff exponencial
      const backoffMs = Math.pow(2, message.retries) * 1000;
      await this.delay(backoffMs);

      // Marcar el mensaje como fallido con el mensaje de error seguro
      await this.outboxService.markAsFailed(message.id, errorMessage);
    }
  }

  /**
   * Publica un evento en el EventBus
   */
  private async publishEvent(eventType: string, payload: any): Promise<void> {
    // Crear evento genérico si no hay mapeo específico
    const EventClass = EVENT_MAPPINGS[eventType];

    if (EventClass) {
      const event = new EventClass(payload);
      await this.eventBus.publish(event);
    } else {
      // Publicar como evento genérico
      await this.eventBus.publish({
        type: eventType,
        payload,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Utilidad para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
