import { Injectable } from '@nestjs/common';
import { Cuadre, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  ICuadreRepository,
  CuadreConTanda,
  FindCuadresOptions,
  PaginatedCuadres,
  CreateCuadreData,
  CountCuadresOptions,
  DesgloseCuadre,
} from '../domain/cuadre.repository.interface';

/**
 * Implementación del repositorio de cuadres con Prisma
 */
@Injectable()
export class PrismaCuadreRepository implements ICuadreRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeTanda = {
    tanda: {
      include: {
        lote: true,
      },
    },
  };

  async findById(id: string): Promise<CuadreConTanda | null> {
    return this.prisma.cuadre.findUnique({
      where: { id },
      include: this.includeTanda,
    }) as Promise<CuadreConTanda | null>;
  }

  async findByTandaId(tandaId: string): Promise<CuadreConTanda | null> {
    return this.prisma.cuadre.findUnique({
      where: { tandaId },
      include: this.includeTanda,
    }) as Promise<CuadreConTanda | null>;
  }

  async findAll(options?: FindCuadresOptions): Promise<PaginatedCuadres> {
    const { skip = 0, take = 20, where = {}, orderBy } = options || {};

    // Custom orderBy: use Prisma native query
    if (orderBy) {
      const whereCondition: Prisma.CuadreWhereInput = {};
      if (where.estado) whereCondition.estado = where.estado;
      if (where.concepto) whereCondition.concepto = where.concepto;
      if (where.loteId) whereCondition.tanda = { loteId: where.loteId };
      if (where.vendedorId) {
        whereCondition.tanda = {
          ...(whereCondition.tanda as any),
          lote: { vendedorId: where.vendedorId },
        };
      }
      const [cuadres, total] = await Promise.all([
        this.prisma.cuadre.findMany({
          where: whereCondition,
          orderBy: { [orderBy.field]: orderBy.direction },
          skip,
          take: take + 1,
          include: this.includeTanda,
        }),
        this.prisma.cuadre.count({ where: whereCondition }),
      ]);
      const hasMore = cuadres.length > take;
      if (hasMore) cuadres.pop();
      return {
        data: cuadres as CuadreConTanda[],
        total,
        hasMore,
        nextCursor: hasMore ? cuadres.at(-1)?.id : undefined,
      };
    }

    // Default: CASE WHEN ordering (PENDIENTE → EXITOSO → INACTIVO, date desc within each)
    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    const needsJoin = !!(where.loteId || where.vendedorId);

    if (where.estado) conditions.push(Prisma.sql`c.estado::text = ${where.estado}`);
    if (where.concepto) conditions.push(Prisma.sql`c.concepto::text = ${where.concepto}`);
    if (where.loteId) conditions.push(Prisma.sql`t."loteId" = ${where.loteId}`);
    if (where.vendedorId) conditions.push(Prisma.sql`l."vendedorId" = ${where.vendedorId}`);

    const whereClause = Prisma.join(conditions, ' AND ');
    const fromClause = needsJoin
      ? Prisma.sql`"cuadres" c LEFT JOIN "tandas" t ON c."tandaId" = t.id LEFT JOIN "lotes" l ON t."loteId" = l.id`
      : Prisma.sql`"cuadres" c`;

    const [rawIds, totalResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT c.id FROM ${fromClause}
        WHERE ${whereClause}
        ORDER BY
          CASE c.estado::text
            WHEN 'PENDIENTE' THEN 0
            WHEN 'INACTIVO' THEN 1
            WHEN 'EXITOSO' THEN 2
            ELSE 3
          END,
          CASE c.estado::text
            WHEN 'PENDIENTE' THEN EXTRACT(EPOCH FROM c."fechaPendiente")
            WHEN 'EXITOSO' THEN EXTRACT(EPOCH FROM c."fechaExitoso")
            ELSE NULL
          END DESC NULLS LAST,
          c.id DESC
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

    const cuadres = await this.prisma.cuadre.findMany({
      where: { id: { in: ids } },
      include: this.includeTanda,
    });

    const idOrder = new Map(ids.map((id, i) => [id, i]));
    cuadres.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);

    return {
      data: cuadres as CuadreConTanda[],
      total,
      hasMore,
      nextCursor: undefined,
    };
  }

  async findByLoteId(loteId: string): Promise<CuadreConTanda[]> {
    return this.prisma.cuadre.findMany({
      where: {
        tanda: { loteId },
      },
      include: this.includeTanda,
      orderBy: { tanda: { numero: 'asc' } },
    }) as Promise<CuadreConTanda[]>;
  }

  async findByVendedorId(
    vendedorId: string,
    options?: FindCuadresOptions,
  ): Promise<PaginatedCuadres> {
    return this.findAll({
      ...options,
      where: {
        ...options?.where,
        vendedorId,
      },
    });
  }

  async create(data: CreateCuadreData): Promise<Cuadre> {
    return this.prisma.cuadre.create({
      data: {
        tandaId: data.tandaId,
        concepto: data.concepto,
        montoEsperado: data.montoEsperado.toFixed(2),
        montoRecibido: '0',
        montoFaltante: data.montoEsperado.toFixed(2),
        montoCubiertoPorMayor: '0',
        estado: 'INACTIVO',
        ...(data.desglose ? { desglose: data.desglose as any } : {}),
      },
    });
  }

  async activar(id: string): Promise<Cuadre> {
    return this.prisma.cuadre.update({
      where: { id },
      data: {
        estado: 'PENDIENTE',
        fechaPendiente: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async confirmarExitoso(id: string, montoRecibido: Decimal): Promise<Cuadre> {
    const cuadre = await this.prisma.cuadre.findUnique({ where: { id } });
    if (!cuadre) {
      throw new Error('Cuadre no encontrado');
    }

    const montoEsperado = new Decimal(cuadre.montoEsperado);
    const montoCubierto = new Decimal(cuadre.montoCubiertoPorMayor);
    const montoRequerido = montoEsperado.minus(montoCubierto);
    const montoFaltante = montoRequerido.minus(montoRecibido);

    return this.prisma.cuadre.update({
      where: { id },
      data: {
        estado: 'EXITOSO',
        montoRecibido: montoRecibido.toFixed(2),
        montoFaltante: montoFaltante.greaterThan(0) ? montoFaltante.toFixed(2) : '0',
        fechaExitoso: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async cerrarPorMayor(id: string, cuadreMayorId: string, montoCubierto: Decimal): Promise<Cuadre> {
    return this.prisma.cuadre.update({
      where: { id },
      data: {
        estado: 'EXITOSO',
        montoCubiertoPorMayor: montoCubierto.toFixed(2),
        cerradoPorCuadreMayorId: cuadreMayorId,
        montoFaltante: '0',
        fechaExitoso: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async actualizarMontoEsperado(
    id: string,
    montoEsperado: Decimal,
    desglose?: DesgloseCuadre,
  ): Promise<Cuadre> {
    const cuadre = await this.prisma.cuadre.findUnique({ where: { id } });
    if (!cuadre) {
      throw new Error('Cuadre no encontrado');
    }

    const montoCubierto = new Decimal(cuadre.montoCubiertoPorMayor);
    const montoFaltante = montoEsperado.minus(montoCubierto);

    return this.prisma.cuadre.update({
      where: { id },
      data: {
        montoEsperado: montoEsperado.toFixed(2),
        montoFaltante: montoFaltante.greaterThan(0) ? montoFaltante.toFixed(2) : '0',
        version: { increment: 1 },
        ...(desglose ? { desglose: desglose as any } : {}),
      },
    });
  }

  async findCuadresParaActivar(loteId: string): Promise<CuadreConTanda[]> {
    return this.prisma.cuadre.findMany({
      where: {
        estado: 'INACTIVO',
        tanda: { loteId },
      },
      include: this.includeTanda,
      orderBy: { tanda: { numero: 'asc' } },
    }) as Promise<CuadreConTanda[]>;
  }

  async count(options?: CountCuadresOptions): Promise<number> {
    const where: Prisma.CuadreWhereInput = {};

    if (options?.estado) where.estado = options.estado;
    if (options?.loteId) {
      where.tanda = { loteId: options.loteId };
    }
    if (options?.vendedorId) {
      where.tanda = {
        ...(where.tanda as any),
        lote: { vendedorId: options.vendedorId },
      };
    }

    return this.prisma.cuadre.count({ where });
  }
}
