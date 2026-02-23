import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
/**
 * Outbox Service
 * Según sección 23 del documento: Outbox Pattern para eventos confiables
 *
 * FLUJO:
 * 1. Use case ejecuta lógica de negocio en transacción
 * 2. Eventos se guardan en tabla Outbox dentro de la misma transacción
 * 3. Outbox Processor lee eventos pendientes y los publica
 * 4. Event Handlers procesan los eventos
 *
 * GARANTÍAS:
 * - At-least-once delivery
 * - Handlers deben ser idempotentes
 * - Fallos se reintentan con backoff exponencial (máx 3 reintentos)
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly MAX_RETRIES = 3;

  constructor(private readonly prisma: PrismaService) {}
  /**
   * Guarda un evento en el outbox dentro de una transacción de negocio.
   * Llamar esto en el mismo bloque de transacción Prisma que la operación de negocio
   * garantiza at-least-once delivery aunque el servidor falle después del commit.
   *
   * @param eventType - Nombre del evento (ej: 'LoteActivado'). Debe coincidir con EVENT_MAPPINGS.
   * @param payload   - Datos serializables del evento (todos los campos del constructor).
   * @param tx        - Transacción Prisma activa (opcional; si no se pasa usa la conexión default).
   */
  async create(
    eventType: string,
    payload: Record<string, unknown>,
    tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await (client as any).outbox.create({ data: { eventType, payload } });
    this.logger.debug(`Evento guardado en outbox: ${eventType}`);
  }

  /**
   * Obtiene mensajes pendientes de procesar
   */
  async getPendingMessages(limit: number = 100): Promise<any[]> {
    return this.prisma.outbox.findMany({
      where: {
        processedAt: null,
        retries: { lt: this.MAX_RETRIES },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Marca un mensaje como procesado
   */
  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }

  /**
   * Marca un mensaje como fallido e incrementa reintentos
   */
  async markAsFailed(id: string, error: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: {
        error,
        retries: { increment: 1 },
      },
    });
  }

  /**
   * Elimina mensajes procesados antiguos
   * Según documento: elimina eventos procesados con más de 7 días
   */
  async cleanupProcessed(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.outbox.deleteMany({
      where: {
        processedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Limpieza de outbox: ${result.count} mensajes eliminados`);
    }

    return result.count;
  }
}
