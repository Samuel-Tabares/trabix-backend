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
        nombres: true,
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
    const { skip = 0, take = 20, cursor, where = {} } = options || {};

    const whereCondition: Prisma.VentaMayorWhereInput = {};

    if (where.vendedorId) whereCondition.vendedorId = where.vendedorId;
    if (where.estado) whereCondition.estado = where.estado;
    if (where.modalidad) whereCondition.modalidad = where.modalidad;

    const queryOptions: Prisma.VentaMayorFindManyArgs = {
      where: whereCondition,
      orderBy: { fechaRegistro: 'desc' },
      take: take + 1,
      include: this.includeRelations,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    } else {
      queryOptions.skip = skip;
    }

    const [ventas, total] = await Promise.all([
      this.prisma.ventaMayor.findMany(queryOptions),
      this.prisma.ventaMayor.count({ where: whereCondition }),
    ]);

    const hasMore = ventas.length > take;
    if (hasMore) ventas.pop();

    return {
      data: ventas as VentaMayorConRelaciones[],
      total,
      hasMore,
      nextCursor: hasMore ? ventas.at(-1)?.id : undefined,
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
