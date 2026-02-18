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
    const { skip = 0, take = 20, cursor, where = {}, orderBy } = options || {};

    const whereCondition: Prisma.CuadreWhereInput = {};

    if (where.estado) whereCondition.estado = where.estado;
    if (where.concepto) whereCondition.concepto = where.concepto;
    if (where.loteId) {
      whereCondition.tanda = { loteId: where.loteId };
    }
    if (where.vendedorId) {
      whereCondition.tanda = {
        ...(whereCondition.tanda as any),
        lote: { vendedorId: where.vendedorId },
      };
    }

    const orderByCondition: Prisma.CuadreOrderByWithRelationInput = orderBy
      ? { [orderBy.field]: orderBy.direction }
      : { fechaPendiente: 'desc' };

    const queryOptions: Prisma.CuadreFindManyArgs = {
      where: whereCondition,
      orderBy: orderByCondition,
      take: take + 1,
      include: this.includeTanda,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    } else {
      queryOptions.skip = skip;
    }

    const [cuadres, total] = await Promise.all([
      this.prisma.cuadre.findMany(queryOptions),
      this.prisma.cuadre.count({ where: whereCondition }),
    ]);

    const hasMore = cuadres.length > take;
    if (hasMore) {
      cuadres.pop();
    }

    return {
      data: cuadres as CuadreConTanda[],
      total,
      hasMore,
      nextCursor: hasMore ? cuadres.at(-1)?.id : undefined,
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

  async actualizarMontoEsperado(id: string, montoEsperado: Decimal): Promise<Cuadre> {
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
