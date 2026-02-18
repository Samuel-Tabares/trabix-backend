import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';

/**
 * CleanupExpiredTokensJob
 * Según sección 23 del documento:
 *
 * - Frecuencia: cada 1 hora
 * - Acción: elimina tokens expirados de TokenBlacklist
 */
@Injectable()
export class CleanupExpiredTokensJob {
  private readonly logger = new Logger(CleanupExpiredTokensJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async execute(): Promise<void> {
    try {
      const result = await this.prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`CleanupExpiredTokensJob: ${result.count} tokens eliminados`);
      }
    } catch (error) {
      this.logger.error('Error en CleanupExpiredTokensJob', error);
    }
  }
}

/**
 * CleanupProcessedOutboxJob
 * Según sección 23 del documento:
 *
 * - Frecuencia: cada 24 horas
 * - Acción: elimina eventos procesados con más de 7 días
 */
@Injectable()
export class CleanupProcessedOutboxJob {
  private readonly logger = new Logger(CleanupProcessedOutboxJob.name);

  constructor(private readonly outboxService: OutboxService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async execute(): Promise<void> {
    try {
      const count = await this.outboxService.cleanupProcessed(7);

      if (count > 0) {
        this.logger.log(`CleanupProcessedOutboxJob: ${count} mensajes eliminados`);
      }
    } catch (error) {
      this.logger.error('Error en CleanupProcessedOutboxJob', error);
    }
  }
}

/**
 * CleanupExpiredIdempotencyKeysJob
 * Según sección 23 del documento:
 *
 * - Frecuencia: cada 1 hora
 * - Acción: elimina idempotency keys expiradas
 */
@Injectable()
export class CleanupExpiredIdempotencyKeysJob {
  private readonly logger = new Logger(CleanupExpiredIdempotencyKeysJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async execute(): Promise<void> {
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`CleanupExpiredIdempotencyKeysJob: ${result.count} keys eliminadas`);
      }
    } catch (error) {
      this.logger.error('Error en CleanupExpiredIdempotencyKeysJob', error);
    }
  }
}
