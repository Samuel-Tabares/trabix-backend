import { Injectable } from '@nestjs/common';
import { Lote, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  ILoteRepository,
  LoteConTandas,
  FindLotesOptions,
  PaginatedLotes,
  CreateLoteData,
  CountLotesOptions,
} from '../domain/lote.repository.interface';

/**
 * Implementación del repositorio de lotes con Prisma
 */
@Injectable()
export class PrismaLoteRepository implements ILoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<LoteConTandas | null> {
    return this.prisma.lote.findUnique({
      where: { id },
      include: {
        tandas: {
          orderBy: { numero: 'asc' },
        },
      },
    });
  }

  async findByVendedor(vendedorId: string, options?: FindLotesOptions): Promise<PaginatedLotes> {
    return this.findAll({
      ...options,
      where: {
        ...options?.where,
        vendedorId,
      },
    });
  }

  async findAll(options?: FindLotesOptions): Promise<PaginatedLotes> {
    const { skip = 0, take = 20, cursor, where = {}, orderBy } = options || {};

    const whereCondition: Prisma.LoteWhereInput = {};

    if (where.vendedorId) whereCondition.vendedorId = where.vendedorId;
    if (where.estado) whereCondition.estado = where.estado;
    if (where.modeloNegocio) whereCondition.modeloNegocio = where.modeloNegocio;
    if (where.esLoteForzado !== undefined) {
      whereCondition.esLoteForzado = where.esLoteForzado;
    }

    const orderByCondition: Prisma.LoteOrderByWithRelationInput = orderBy
      ? { [orderBy.field]: orderBy.direction }
      : { fechaCreacion: 'desc' };

    const queryOptions: Prisma.LoteFindManyArgs = {
      where: whereCondition,
      orderBy: orderByCondition,
      take: take + 1,
      include: {
        tandas: {
          orderBy: { numero: 'asc' },
        },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    } else {
      queryOptions.skip = skip;
    }

    const [lotes, total] = await Promise.all([
      this.prisma.lote.findMany(queryOptions),
      this.prisma.lote.count({ where: whereCondition }),
    ]);

    const hasMore = lotes.length > take;
    if (hasMore) {
      lotes.pop();
    }

    return {
      data: lotes as LoteConTandas[],
      total,
      hasMore,
      nextCursor: hasMore ? lotes.at(-1)?.id : undefined,
    };
  }

  async findLoteActivoMasAntiguo(vendedorId: string): Promise<LoteConTandas | null> {
    return this.prisma.lote.findFirst({
      where: {
        vendedorId,
        estado: 'ACTIVO',
      },
      orderBy: {
        fechaActivacion: 'asc',
      },
      include: {
        tandas: {
          orderBy: { numero: 'asc' },
        },
      },
    });
  }

  async create(data: CreateLoteData): Promise<LoteConTandas> {
    return this.prisma.lote.create({
      data: {
        vendedorId: data.vendedorId,
        cantidadTrabix: data.cantidadTrabix,
        modeloNegocio: data.modeloNegocio,
        inversionTotal: data.inversionTotal.toFixed(2),
        inversionAdmin: data.inversionAdmin.toFixed(2),
        inversionVendedor: data.inversionVendedor.toFixed(2),
        dineroRecaudado: 0,
        dineroTransferido: 0,
        esLoteForzado: data.esLoteForzado ?? false,
        ventaMayorOrigenId: data.ventaMayorOrigenId ?? null,
        estado: 'CREADO',
        tandas: {
          create: data.tandas.map((tanda) => ({
            numero: tanda.numero,
            stockInicial: tanda.stockInicial,
            stockActual: tanda.stockInicial,
            estado: 'INACTIVA',
          })),
        },
      },
      include: {
        tandas: {
          orderBy: { numero: 'asc' },
        },
      },
    });
  }

  async activar(id: string): Promise<LoteConTandas> {
    return this.prisma.$transaction(async (tx) => {
      // Actualizar lote a ACTIVO
      const lote = await tx.lote.update({
        where: { id },
        data: {
          estado: 'ACTIVO',
          fechaActivacion: new Date(),
          version: { increment: 1 },
        },
        include: {
          tandas: {
            orderBy: { numero: 'asc' },
          },
        },
      });

      // Liberar primera tanda
      await tx.tanda.update({
        where: { id: lote.tandas[0].id },
        data: {
          estado: 'LIBERADA',
          fechaLiberacion: new Date(),
          version: { increment: 1 },
        },
      });

      return tx.lote.findUnique({
        where: { id },
        include: {
          tandas: {
            orderBy: { numero: 'asc' },
          },
        },
      }) as Promise<LoteConTandas>;
    });
  }

  /**
   * Cancela un lote en estado CREADO
   * Elimina el lote y todas sus tandas (hard delete)
   */
  async cancelar(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Primero eliminar las tandas asociadas
      await tx.tanda.deleteMany({
        where: { loteId: id },
      });

      // Luego eliminar el lote
      await tx.lote.delete({
        where: { id },
      });
    });
  }

  async finalizar(id: string): Promise<LoteConTandas> {
    return this.prisma.lote.update({
      where: { id },
      data: {
        estado: 'FINALIZADO',
        fechaFinalizacion: new Date(),
        version: { increment: 1 },
      },
      include: {
        tandas: {
          orderBy: { numero: 'asc' },
        },
      },
    });
  }

  async actualizarRecaudado(id: string, monto: Decimal): Promise<Lote> {
    return this.prisma.lote.update({
      where: { id },
      data: {
        dineroRecaudado: {
          increment: Number.parseFloat(monto.toFixed(2)),
        },
        version: { increment: 1 },
      },
    });
  }

  async actualizarTransferido(id: string, monto: Decimal): Promise<Lote> {
    return this.prisma.lote.update({
      where: { id },
      data: {
        dineroTransferido: {
          increment: Number.parseFloat(monto.toFixed(2)),
        },
        version: { increment: 1 },
      },
    });
  }

  async count(options?: CountLotesOptions): Promise<number> {
    const where: Prisma.LoteWhereInput = {};

    if (options?.vendedorId) where.vendedorId = options.vendedorId;
    if (options?.estado) where.estado = options.estado;

    return this.prisma.lote.count({ where });
  }

  /**
   * Cuenta los regalos APROBADOS de un lote
   * Solo cuenta ventas con estado APROBADA para evitar contar regalos
   * que podrían ser rechazados posteriormente
   */
  async contarRegalosAprobados(loteId: string): Promise<number> {
    const result = await this.prisma.detalleVenta.aggregate({
      where: {
        tipo: 'REGALO',
        venta: {
          loteId,
          estado: 'APROBADA',
        },
      },
      _sum: {
        cantidad: true,
      },
    });

    return result._sum.cantidad || 0;
  }
}
