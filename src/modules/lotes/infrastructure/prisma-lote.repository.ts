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
        tandas: { orderBy: { numero: 'asc' } },
        vendedor: { select: { id: true, nombre: true, apellidos: true } },
      },
    }) as Promise<LoteConTandas | null>;
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
    const { skip = 0, take = 20, where = {}, orderBy, includeVendedor = false } = options || {};

    // Custom orderBy: use Prisma native query
    if (orderBy) {
      const whereCondition: Prisma.LoteWhereInput = {};
      if (where.vendedorId) whereCondition.vendedorId = where.vendedorId;
      if (where.estado) whereCondition.estado = where.estado;
      if (where.modeloNegocio) whereCondition.modeloNegocio = where.modeloNegocio;
      if (where.esLoteForzado !== undefined) whereCondition.esLoteForzado = where.esLoteForzado;
      if (where.minTrabix !== undefined || where.maxTrabix !== undefined) {
        whereCondition.cantidadTrabix = {
          ...(where.minTrabix !== undefined && { gte: where.minTrabix }),
          ...(where.maxTrabix !== undefined && { lte: where.maxTrabix }),
        };
      }
      if (where.searchVendedor) {
        whereCondition.vendedor = {
          OR: [
            { nombre: { contains: where.searchVendedor, mode: 'insensitive' } },
            { apellidos: { contains: where.searchVendedor, mode: 'insensitive' } },
          ],
        };
      }
      const [lotes, total] = await Promise.all([
        this.prisma.lote.findMany({
          where: whereCondition,
          orderBy: { [orderBy.field]: orderBy.direction },
          skip,
          take: take + 1,
          include: {
            tandas: { orderBy: { numero: 'asc' } },
            ...(includeVendedor && { vendedor: { select: { id: true, nombre: true, apellidos: true } } }),
          },
        }),
        this.prisma.lote.count({ where: whereCondition }),
      ]);
      const hasMore = lotes.length > take;
      if (hasMore) lotes.pop();
      return {
        data: lotes as LoteConTandas[],
        total,
        hasMore,
        nextCursor: hasMore ? lotes.at(-1)?.id : undefined,
      };
    }

    // Default: CASE WHEN status ordering (CREADO → ACTIVO → FINALIZADO, date desc within each)
    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    const needsUserJoin = !!where.searchVendedor;

    if (where.vendedorId) conditions.push(Prisma.sql`l."vendedorId" = ${where.vendedorId}`);
    if (where.estado) conditions.push(Prisma.sql`l.estado::text = ${where.estado}`);
    if (where.modeloNegocio) conditions.push(Prisma.sql`l."modeloNegocio"::text = ${where.modeloNegocio}`);
    if (where.esLoteForzado !== undefined) {
      conditions.push(Prisma.sql`l."esLoteForzado" = ${where.esLoteForzado}`);
    }
    if (where.minTrabix !== undefined) {
      conditions.push(Prisma.sql`l."cantidadTrabix" >= ${where.minTrabix}`);
    }
    if (where.maxTrabix !== undefined) {
      conditions.push(Prisma.sql`l."cantidadTrabix" <= ${where.maxTrabix}`);
    }
    if (needsUserJoin) {
      const search = `%${where.searchVendedor}%`;
      conditions.push(Prisma.sql`(u.nombre ILIKE ${search} OR u.apellidos ILIKE ${search})`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const fromClause = needsUserJoin
      ? Prisma.sql`"lotes" l LEFT JOIN "usuarios" u ON l."vendedorId" = u.id`
      : Prisma.sql`"lotes" l`;

    const [rawIds, totalResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT l.id FROM ${fromClause}
        WHERE ${whereClause}
        ORDER BY
          CASE l.estado::text
            WHEN 'CREADO' THEN 0
            WHEN 'ACTIVO' THEN 1
            WHEN 'FINALIZADO' THEN 2
            ELSE 3
          END,
          l."fechaCreacion" DESC,
          l.id DESC
        LIMIT ${take + 1} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) as count FROM ${fromClause}
        WHERE ${whereClause}
      `),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const ids = rawIds.map((r) => r.id);
    const hasMore = ids.length > take;
    if (hasMore) ids.pop();

    if (ids.length === 0) {
      return { data: [], total, hasMore: false, nextCursor: undefined };
    }

    const lotes = await this.prisma.lote.findMany({
      where: { id: { in: ids } },
      include: {
        tandas: { orderBy: { numero: 'asc' } },
        ...(includeVendedor && { vendedor: { select: { id: true, nombre: true, apellidos: true } } }),
      },
    });

    const idOrder = new Map(ids.map((id, i) => [id, i]));
    lotes.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);

    return {
      data: lotes as LoteConTandas[],
      total,
      hasMore,
      nextCursor: undefined,
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

  async findLotesActivos(vendedorId: string): Promise<LoteConTandas[]> {
    return this.prisma.lote.findMany({
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
    }) as Promise<LoteConTandas[]>;
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

      // Poner primera tanda en tránsito
      await tx.tanda.update({
        where: { id: lote.tandas[0].id },
        data: {
          estado: 'EN_TRANSITO',
          fechaEnTransito: new Date(),
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
        },
      },
      _sum: {
        cantidad: true,
      },
    });

    return result._sum?.cantidad || 0;
  }
}
