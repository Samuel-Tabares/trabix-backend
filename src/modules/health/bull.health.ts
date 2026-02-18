import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Indicador de salud para Bull Queues
 * Verifica que las colas estén conectadas y funcionando
 */
@Injectable()
export class BullHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('tanda-transitions') private readonly tandaTransitionsQueue: Queue,
    @InjectQueue('outbox') private readonly outboxQueue: Queue,
  ) {
    super();
  }

  /**
   * Verifica la salud de todas las colas
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const queues = [
        { name: 'notifications', queue: this.notificationsQueue },
        { name: 'tanda-transitions', queue: this.tandaTransitionsQueue },
        { name: 'outbox', queue: this.outboxQueue },
      ];

      const results: Record<string, any> = {};

      for (const { name, queue } of queues) {
        try {
          // Verificar conexión obteniendo el estado de la cola
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
          ]);

          results[name] = {
            status: 'up',
            waiting,
            active,
            completed,
            failed,
          };
        } catch (error) {
          results[name] = {
            status: 'down',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      // Verificar si alguna cola está caída
      const hasDownQueue = Object.values(results).some((q: any) => q.status === 'down');

      if (hasDownQueue) {
        throw new HealthCheckError(
          'One or more queues are down',
          this.getStatus(key, false, results),
        );
      }

      return this.getStatus(key, true, results);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      throw new HealthCheckError(
        'Bull queues check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
