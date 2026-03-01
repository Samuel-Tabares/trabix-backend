import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { OutboxService } from './outbox.service';
import { EventStoreService, DomainEvent } from '../event-store/event-store.service';

// Eventos de dominio registrados
import { LoteActivadoEvent } from '../../../modules/lotes/application/events/lote-activado.event';
import { CuadreExitosoEvent } from '../../../modules/cuadres/application/events/cuadre-exitoso.event';
import { MiniCuadreExitosoEvent } from '../../../modules/mini-cuadres/application/events/mini-cuadre-exitoso.event';
import { StockUltimaTandaAgotadoEvent } from '../../../modules/mini-cuadres/application/events/stock-ultima-tanda-agotado.event';
import { VentaRegistradaEvent } from '../../../modules/ventas/application/events/venta-aprobada.event';
import { CuadreMayorExitosoEvent } from '../../../modules/cuadres-mayor/application/events/cuadre-mayor-exitoso.event';

/**
 * Mapeo de eventType → factory function que reconstruye el evento desde el payload JSON.
 *
 * Cada factory recibe el payload tal como fue serializado en el outbox y
 * reconstruye el evento con los tipos correctos (Decimal, arrays, etc.).
 * El nombre de la clave debe coincidir exactamente con el eventType guardado en el outbox.
 */
const EVENT_MAPPINGS: Record<string, (payload: any) => any> = {
  LoteActivado: (p) =>
    new LoteActivadoEvent(p.loteId, p.vendedorId, p.cantidadTrabix, p.modeloNegocio, p.tandas),

  CuadreExitoso: (p) =>
    new CuadreExitosoEvent(
      p.cuadreId,
      p.tandaId,
      p.loteId,
      p.vendedorId,
      new Decimal(p.montoRecibido),
      p.numeroTanda,
    ),

  MiniCuadreExitoso: (p) =>
    new MiniCuadreExitosoEvent(p.miniCuadreId, p.loteId, p.tandaId, p.vendedorId, p.montoFinal),

  StockUltimaTandaAgotado: (p) => new StockUltimaTandaAgotadoEvent(p.tandaId, p.loteId),

  VentaRegistrada: (p) =>
    new VentaRegistradaEvent(
      p.ventaId,
      p.vendedorId,
      p.loteId,
      p.tandaId,
      new Decimal(p.montoTotal),
      p.cantidadTrabix,
    ),

  CuadreMayorExitoso: (p) =>
    new CuadreMayorExitosoEvent(
      p.cuadreMayorId,
      p.vendedorId,
      p.lotesInvolucradosIds,
      p.cuadresCerradosIds,
      p.loteForzadoId,
    ),

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

      // Marcar el mensaje como fallido antes de continuar procesando otros mensajes.
      // El backoff exponencial (1s, 2s, 4s...) debe aplicarse en el momento del *siguiente intento*
      // comparando message.retries contra un nextRetryAt calculado por markAsFailed,
      // no bloqueando el procesador aquí con un delay que detendría todos los mensajes pendientes.
      await this.outboxService.markAsFailed(message.id, errorMessage);
    }
  }

  /**
   * Publica un evento en el EventBus.
   * Si existe una factory en EVENT_MAPPINGS, reconstruye el evento tipado para que
   * los @EventsHandler registrados lo reciban correctamente.
   * Si no existe mapeo, publica como objeto genérico (solo quedará en EventStore).
   */
  private async publishEvent(eventType: string, payload: any): Promise<void> {
    const factory = EVENT_MAPPINGS[eventType];

    if (factory) {
      const event = factory(payload);
      await this.eventBus.publish(event);
    } else {
      this.logger.warn(
        `Sin mapeo para eventType "${eventType}". Publicando como evento genérico.`,
      );
      await this.eventBus.publish({ type: eventType, payload, timestamp: new Date() });
    }
  }

}
