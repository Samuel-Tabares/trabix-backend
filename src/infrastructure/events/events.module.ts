import { Module, Global } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventStoreService } from './event-store/event-store.service';
import { OutboxService } from './outbox/outbox.service';
import { OutboxProcessor } from './outbox/outbox.processor';

/**
 * EventsModule
 * Según sección 23 del documento: Arquitectura de eventos
 *
 * TECNOLOGÍAS:
 * - Eventos síncronos: @nestjs/cqrs EventBus
 * - Eventos asíncronos: Bull queues + Redis
 * - Persistencia: Outbox Pattern + EventStore
 *
 * FLUJO DE EVENTOS:
 * 1. Use case ejecuta lógica de negocio en transacción
 * 2. Eventos se guardan en tabla Outbox dentro de la misma transacción
 * 3. Outbox Processor lee eventos pendientes y los publica
 * 4. Event Handlers procesan los eventos
 * 5. Eventos se persisten en EventStore para auditoría
 */
@Global()
@Module({
  imports: [CqrsModule],
  providers: [EventStoreService, OutboxService, OutboxProcessor],
  exports: [EventStoreService, OutboxService],
})
export class EventsModule {}
