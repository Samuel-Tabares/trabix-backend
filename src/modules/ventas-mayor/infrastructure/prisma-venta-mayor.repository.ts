import { Injectable } from '@nestjs/common';
import { VentaMayor, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IVentaMayorRepository,
  VentaMayorConRelaciones,
  FindVentasMayorOptions,
  PaginatedVentasMayor,
  CreateVentaMayorData,
} from '../domain/venta-mayor.repository.interface';

/**
 * Implementación del repositorio de ventas al mayor con Prisma
 */
@Injectable()
export class PrismaVentaMayorRepository implements IVentaMayorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    vendedor: {
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
      },
    },
    fuentesStock: true,
    lotesInvolucrados: true,
    cuadreMayor: {
      select: {
        id: true,
        estado: true,
      },
    },
  };

  async findById(id: string): Promise<VentaMayorConRelaciones | null> {
    return this.prisma.ventaMayor.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<VentaMayorConRelaciones | null>;
  }

  async findAll(options?: FindVentasMayorOptions): Promise<PaginatedVentasMayor> {
    const { skip = 0, take = 20, where = {} } = options || {};

    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    const needsUserJoin = !!where.searchVendedor;

    if (where.vendedorId) conditions.push(Prisma.sql`v."vendedorId" = ${where.vendedorId}`);
    if (where.estado) conditions.push(Prisma.sql`v.estado::text = ${where.estado}`);
    if (where.modalidad) conditions.push(Prisma.sql`v.modalidad::text = ${where.modalidad}`);
    if (needsUserJoin) {
      const search = `%${where.searchVendedor}%`;
      conditions.push(Prisma.sql`(u.nombre ILIKE ${search} OR u.apellidos ILIKE ${search})`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const fromClause = needsUserJoin
      ? Prisma.sql`"ventas_mayor" v LEFT JOIN "usuarios" u ON v."vendedorId" = u.id`
      : Prisma.sql`"ventas_mayor" v`;

    const [rawIds, totalResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT v.id FROM ${fromClause}
        WHERE ${whereClause}
        ORDER BY
          CASE v.estado::text
            WHEN 'PENDIENTE' THEN 0
            WHEN 'COMPLETADA' THEN 1
            ELSE 2
          END,
          v."fechaRegistro" DESC,
          v.id DESC
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

    const ventas = await this.prisma.ventaMayor.findMany({
      where: { id: { in: ids } },
      include: this.includeRelations,
    });

    const idOrder = new Map(ids.map((id, i) => [id, i]));
    ventas.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);

    return {
      data: ventas as unknown as VentaMayorConRelaciones[],
      total,
      hasMore,
      nextCursor: undefined,
    };
  }

  async findByVendedorId(
    vendedorId: string,
    options?: FindVentasMayorOptions,
  ): Promise<PaginatedVentasMayor> {
    return this.findAll({
      ...options,
      where: { ...options?.where, vendedorId },
    });
  }

  async create(data: CreateVentaMayorData): Promise<VentaMayor> {
    return this.prisma.$transaction(async (tx) => {
      // Crear la venta al mayor
      const venta = await tx.ventaMayor.create({
        data: {
          vendedorId: data.vendedorId,
          cantidadUnidades: data.cantidadUnidades,
          precioUnidad: data.precioUnidad.toFixed(2),
          ingresoBruto: data.ingresoBruto.toFixed(2),
          conLicor: data.conLicor,
          modalidad: data.modalidad,
          estado: 'PENDIENTE',
        },
      });

      // Crear las fuentes de stock
      if (data.fuentesStock.length > 0) {
        await tx.fuenteStockMayor.createMany({
          data: data.fuentesStock.map((f) => ({
            ventaMayorId: venta.id,
            tandaId: f.tandaId,
            cantidadConsumida: f.cantidadConsumida,
            tipoStock: f.tipoStock,
          })),
        });
      }

      // Crear las relaciones con lotes
      if (data.lotesInvolucradosIds.length > 0) {
        await tx.loteVentaMayor.createMany({
          data: data.lotesInvolucradosIds.map((loteId) => ({
            ventaMayorId: venta.id,
            loteId,
          })),
        });
      }

      return venta;
    });
  }

  async completar(id: string): Promise<VentaMayor> {
    return this.prisma.ventaMayor.update({
      where: { id },
      data: {
        estado: 'COMPLETADA',
        fechaCompletada: new Date(),
      },
    });
  }

  async count(options?: { vendedorId?: string; estado?: any }): Promise<number> {
    const where: Prisma.VentaMayorWhereInput = {};
    if (options?.vendedorId) where.vendedorId = options.vendedorId;
    if (options?.estado) where.estado = options.estado;
    return this.prisma.ventaMayor.count({ where });
  }
}
