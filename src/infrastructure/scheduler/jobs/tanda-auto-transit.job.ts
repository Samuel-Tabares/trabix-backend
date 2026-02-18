import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * TandaAutoTransitJob
 * Según sección 23 del documento:
 *
 * - Frecuencia: cada 5 minutos
 * - Acción: transiciona tandas LIBERADA → EN_TRÁNSITO después de 2 horas
 *
 * IDEMPOTENCIA:
 * Solo transiciona si:
 * - tanda.estado = LIBERADA
 * - fechaLiberacion + 2 horas <= ahora
 * - Usa el campo `version` para evitar race conditions
 */
@Injectable()
export class TandaAutoTransitJob {
  private readonly logger = new Logger(TandaAutoTransitJob.name);
  private readonly TIEMPO_AUTO_TRANSITO_HORAS =
    this.configService.get<number>('tiempos.autoTransitoHoras') ?? 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Se ejecuta cada 5 minutos
   */
  @Cron('*/5 * * * *')
  async execute(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.TIEMPO_AUTO_TRANSITO_HORAS);

      // Buscar tandas elegibles para transición
      const tandasElegibles = await this.prisma.tanda.findMany({
        where: {
          estado: 'LIBERADA',
          fechaLiberacion: {
            lte: cutoffDate,
          },
        },
        select: {
          id: true,
          numero: true,
          loteId: true,
          version: true,
          fechaLiberacion: true,
        },
      });

      if (tandasElegibles.length === 0) {
        return;
      }

      this.logger.log(
        `TandaAutoTransitJob: ${tandasElegibles.length} tandas elegibles para transición`,
      );

      // Procesar cada tanda
      for (const tanda of tandasElegibles) {
        await this.transicionarTanda(tanda);
      }
    } catch (error) {
      this.logger.error('Error en TandaAutoTransitJob', error);
    }
  }

  /**
   * Transiciona una tanda de LIBERADA a EN_TRÁNSITO
   * Usa el campo version para optimistic locking y evitar race conditions
   */
  private async transicionarTanda(tanda: {
    id: string;
    numero: number;
    loteId: string;
    version: number;
    fechaLiberacion: Date | null;
  }): Promise<void> {
    try {
      // Usar optimistic locking con version para evitar race conditions
      const result = await this.prisma.tanda.updateMany({
        where: {
          id: tanda.id,
          estado: 'LIBERADA',
          version: tanda.version, // Optimistic locking
        },
        data: {
          estado: 'EN_TRANSITO',
          fechaEnTransito: new Date(),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        this.logger.debug(
          `Tanda ${tanda.id} ya fue procesada por otra instancia (version mismatch)`,
        );
        return;
      }

      this.logger.log(
        `Tanda transicionada: ${tanda.id} (Lote: ${tanda.loteId}, T${tanda.numero}) - LIBERADA → EN_TRÁNSITO`,
      );
    } catch (error) {
      this.logger.error(`Error transicionando tanda ${tanda.id}`, error);
    }
  }
}
