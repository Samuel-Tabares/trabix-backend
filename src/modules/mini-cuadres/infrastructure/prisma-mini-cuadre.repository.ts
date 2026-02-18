import { Injectable, Logger } from '@nestjs/common';
import { MiniCuadre, EstadoMiniCuadre } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IMiniCuadreRepository,
  MiniCuadreConRelaciones,
  CreateMiniCuadreData,
  ConfirmacionMiniCuadreResult,
} from '../domain/mini-cuadre.repository.interface';

/**
 * Implementación del repositorio de mini-cuadres con Prisma
 */
@Injectable()
export class PrismaMiniCuadreRepository implements IMiniCuadreRepository {
  private readonly logger = new Logger(PrismaMiniCuadreRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    lote: {
      select: {
        id: true,
        vendedorId: true,
        estado: true,
        cantidadTrabix: true,
      },
    },
  };

  async findById(id: string): Promise<MiniCuadreConRelaciones | null> {
    return this.prisma.miniCuadre.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<MiniCuadreConRelaciones | null>;
  }

  async findByLoteId(loteId: string): Promise<MiniCuadreConRelaciones | null> {
    return this.prisma.miniCuadre.findUnique({
      where: { loteId },
      include: this.includeRelations,
    }) as Promise<MiniCuadreConRelaciones | null>;
  }

  async create(data: CreateMiniCuadreData): Promise<MiniCuadre> {
    return this.prisma.miniCuadre.create({
      data: {
        loteId: data.loteId,
        tandaId: data.tandaId,
        estado: 'INACTIVO',
        montoFinal: 0,
      },
    });
  }

  async activar(id: string, montoFinal: Decimal): Promise<MiniCuadre> {
    return this.prisma.miniCuadre.update({
      where: { id },
      data: {
        estado: 'PENDIENTE',
        montoFinal: montoFinal.toFixed(2),
        fechaPendiente: new Date(),
      },
    });
  }

  async confirmarExitoso(id: string): Promise<MiniCuadre> {
    return this.prisma.miniCuadre.update({
      where: { id },
      data: {
        estado: 'EXITOSO',
        fechaExitoso: new Date(),
      },
    });
  }

  /**
   * Confirma mini-cuadre con finalización de tanda y lote en una transacción
   *
   * Operaciones atómicas (replica exactamente la lógica de los repositorios originales):
   * 1. Finalizar última tanda (estado: FINALIZADA, fechaFinalizada, version++)
   * 2. Finalizar lote (estado: FINALIZADO, fechaFinalizacion, version++)
   * 3. Confirmar mini-cuadre (estado: EXITOSO, fechaExitoso)
   *
   * Si cualquier operación falla, se hace rollback automático
   */
  async confirmarConFinalizacion(
    miniCuadreId: string,
    tandaId: string,
    loteId: string,
  ): Promise<ConfirmacionMiniCuadreResult> {
    this.logger.log(
      `Iniciando transacción de confirmación: MiniCuadre=${miniCuadreId}, Tanda=${tandaId}, Lote=${loteId}`,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Finalizar última tanda (replica prisma-tanda.repository.ts -> finalizar)
      await tx.tanda.update({
        where: { id: tandaId },
        data: {
          estado: 'FINALIZADA',
          fechaFinalizada: new Date(),
          version: { increment: 1 },
        },
      });
      this.logger.debug(`[TX] Tanda finalizada: ${tandaId}`);

      // 2. Finalizar lote (replica prisma-lote.repository.ts -> finalizar)
      await tx.lote.update({
        where: { id: loteId },
        data: {
          estado: 'FINALIZADO',
          fechaFinalizacion: new Date(),
          version: { increment: 1 },
        },
      });
      this.logger.debug(`[TX] Lote finalizado: ${loteId}`);

      // 3. Confirmar mini-cuadre como EXITOSO
      const miniCuadreActualizado = await tx.miniCuadre.update({
        where: { id: miniCuadreId },
        data: {
          estado: 'EXITOSO',
          fechaExitoso: new Date(),
        },
      });
      this.logger.debug(`[TX] Mini-cuadre confirmado: ${miniCuadreId}`);

      return miniCuadreActualizado;
    });

    this.logger.log(`Transacción completada exitosamente: MiniCuadre=${miniCuadreId}`);

    return {
      miniCuadre: result,
      tandaFinalizada: true,
      loteFinalizado: true,
    };
  }

  async findByEstado(estado: EstadoMiniCuadre): Promise<MiniCuadreConRelaciones[]> {
    return this.prisma.miniCuadre.findMany({
      where: { estado },
      include: this.includeRelations,
      orderBy: { fechaPendiente: 'asc' },
    }) as Promise<MiniCuadreConRelaciones[]>;
  }

  async countByEstado(estado: EstadoMiniCuadre): Promise<number> {
    return this.prisma.miniCuadre.count({
      where: { estado },
    });
  }
}
