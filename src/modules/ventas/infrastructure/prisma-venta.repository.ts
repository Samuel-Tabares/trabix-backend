import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IVentaRepository,
  VentaConDetalles,
  FindVentasOptions,
  PaginatedVentas,
  CreateVentaData,
  CountVentasOptions,
} from '../domain/venta.repository.interface';

/**
 * Implementación del repositorio de ventas con Prisma
 */
@Injectable()
export class PrismaVentaRepository implements IVentaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<VentaConDetalles | null> {
    return this.prisma.venta.findUnique({
      where: { id },
      include: {
        detalles: true,
        vendedor: { select: { nombre: true, telefono: true } },
      },
    });
  }

  async findAll(options?: FindVentasOptions): Promise<PaginatedVentas> {
    const { skip = 0, take = 20, cursor, where = {}, orderBy } = options || {};

    const whereCondition: Prisma.VentaWhereInput = {};

    if (where.vendedorId) whereCondition.vendedorId = where.vendedorId;
    if (where.loteId) whereCondition.loteId = where.loteId;
    if (where.tandaId) whereCondition.tandaId = where.tandaId;
    if (where.estado) whereCondition.estado = where.estado;

    const orderByCondition: Prisma.VentaOrderByWithRelationInput = orderBy
      ? { [orderBy.field]: orderBy.direction }
      : { fechaRegistro: 'desc' };

    const queryOptions: Prisma.VentaFindManyArgs = {
      where: whereCondition,
      orderBy: orderByCondition,
      take: take + 1,
      include: {
        detalles: true,
        vendedor: { select: { nombre: true, telefono: true } },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    } else {
      queryOptions.skip = skip;
    }

    const [ventas, total] = await Promise.all([
      this.prisma.venta.findMany(queryOptions),
      this.prisma.venta.count({ where: whereCondition }),
    ]);

    const hasMore = ventas.length > take;
    if (hasMore) {
      ventas.pop();
    }

    return {
      data: ventas as VentaConDetalles[],
      total,
      hasMore,
      nextCursor: hasMore ? ventas.at(-1)?.id : undefined,
    };
  }

  async findByVendedor(vendedorId: string, options?: FindVentasOptions): Promise<PaginatedVentas> {
    return this.findAll({
      ...options,
      where: {
        ...options?.where,
        vendedorId,
      },
    });
  }

  async findByLote(loteId: string): Promise<VentaConDetalles[]> {
    return this.prisma.venta.findMany({
      where: { loteId },
      include: { detalles: true },
      orderBy: { fechaRegistro: 'desc' },
    });
  }

  async findByTanda(tandaId: string): Promise<VentaConDetalles[]> {
    return this.prisma.venta.findMany({
      where: { tandaId },
      include: { detalles: true },
      orderBy: { fechaRegistro: 'desc' },
    });
  }

  async create(data: CreateVentaData): Promise<VentaConDetalles> {
    return this.prisma.venta.create({
      data: {
        vendedorId: data.vendedorId,
        loteId: data.loteId,
        tandaId: data.tandaId,
        montoTotal: data.montoTotal.toFixed(2),
        cantidadTrabix: data.cantidadTrabix,
        estado: 'PENDIENTE',
        detalles: {
          create: data.detalles.map((detalle) => ({
            tipo: detalle.tipo,
            cantidad: detalle.cantidad,
            precioUnitario: detalle.precioUnitario.toFixed(2),
            subtotal: detalle.subtotal.toFixed(2),
          })),
        },
      },
      include: {
        detalles: true,
      },
    });
  }

  async aprobar(id: string): Promise<VentaConDetalles> {
    return this.prisma.venta.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        fechaValidacion: new Date(),
      },
      include: {
        detalles: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.detalleVenta.deleteMany({ where: { ventaId: id } }),
      this.prisma.venta.delete({ where: { id } }),
    ]);
  }

  /**
   * Cuenta los regalos APROBADOS de un lote
   * Solo cuenta ventas con estado APROBADA para tener consistencia
   * con el cálculo del resumen financiero
   */
  async contarRegalosPorLote(loteId: string): Promise<number> {
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

  async count(options?: CountVentasOptions): Promise<number> {
    const where: Prisma.VentaWhereInput = {};

    if (options?.vendedorId) where.vendedorId = options.vendedorId;
    if (options?.loteId) where.loteId = options.loteId;
    if (options?.estado) where.estado = options.estado;

    return this.prisma.venta.count({ where });
  }
}
