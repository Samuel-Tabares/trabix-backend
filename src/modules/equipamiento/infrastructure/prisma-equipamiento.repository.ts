import { Injectable } from '@nestjs/common';
import { Equipamiento, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IEquipamientoRepository,
  CreateEquipamientoData,
  FindEquipamientosOptions,
  PaginatedEquipamientos,
} from '../domain/equipamiento.repository.interface';

@Injectable()
export class PrismaEquipamientoRepository implements IEquipamientoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Equipamiento | null> {
    return this.prisma.equipamiento.findUnique({
      where: { id },
      include: {
        vendedor: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            cedula: true,
            telefono: true,
          },
        },
        abonos: {
          orderBy: { fecha: 'desc' },
        },
      },
    }) as Promise<Equipamiento | null>;
  }

  async findByVendedorId(vendedorId: string): Promise<Equipamiento | null> {
    return this.prisma.equipamiento.findFirst({
      where: { vendedorId },
      orderBy: { fechaSolicitud: 'desc' },
    });
  }

  async findActivoByVendedorId(vendedorId: string): Promise<Equipamiento | null> {
    return this.prisma.equipamiento.findFirst({
      where: {
        vendedorId,
        estado: {
          in: ['SOLICITADO', 'ACTIVO'],
        },
      },
    });
  }

  async findVigenteByVendedorId(vendedorId: string): Promise<Equipamiento | null> {
    return this.prisma.equipamiento.findFirst({
      where: {
        vendedorId,
        estado: {
          in: ['SOLICITADO', 'ACTIVO', 'PERDIDO'],
        },
      },
      orderBy: { fechaSolicitud: 'desc' },
    });
  }

  async findAll(options: FindEquipamientosOptions): Promise<PaginatedEquipamientos> {
    const { skip = 0, take = 20, where } = options;

    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    const needsUserJoin = !!where?.searchVendedor;

    if (where?.estado) conditions.push(Prisma.sql`e.estado::text = ${where.estado}`);
    if (where?.vendedorId) conditions.push(Prisma.sql`e."vendedorId" = ${where.vendedorId}`);
    if (needsUserJoin) {
      const search = `%${where.searchVendedor}%`;
      conditions.push(Prisma.sql`(u.nombre ILIKE ${search} OR u.apellidos ILIKE ${search})`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const fromClause = needsUserJoin
      ? Prisma.sql`"equipamientos" e LEFT JOIN "usuarios" u ON e."vendedorId" = u.id`
      : Prisma.sql`"equipamientos" e`;

    const [rawIds, totalResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT e.id FROM ${fromClause}
        WHERE ${whereClause}
        ORDER BY
          CASE e.estado::text
            WHEN 'SOLICITADO' THEN 0
            WHEN 'ACTIVO' THEN 1
            WHEN 'DANADO' THEN 2
            WHEN 'PERDIDO' THEN 3
            WHEN 'DEVUELTO' THEN 4
            ELSE 5
          END,
          e."fechaSolicitud" DESC,
          e.id DESC
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
      return { data: [], total, hasMore: false };
    }

    const data = await this.prisma.equipamiento.findMany({
      where: { id: { in: ids } },
      include: {
        vendedor: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            cedula: true,
            telefono: true,
          },
        },
      },
    });

    const idOrder = new Map(ids.map((id, i) => [id, i]));
    data.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);

    return { data, total, hasMore };
  }

  async create(data: CreateEquipamientoData): Promise<Equipamiento> {
    return this.prisma.equipamiento.create({
      data: {
        vendedorId: data.vendedorId,
        tieneDeposito: data.tieneDeposito,
        depositoPagado: data.depositoPagado?.toFixed(2),
        mensualidadActual: data.mensualidadActual.toFixed(2),
        estado: 'SOLICITADO',
      },
    });
  }

  async activar(id: string): Promise<Equipamiento> {
    const ahora = new Date();
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        estado: 'ACTIVO',
        fechaEntrega: ahora,
        ultimaMensualidadPagada: ahora, // Primera mensualidad cuenta desde la entrega
      },
    });
  }

  async reportarDano(
    id: string,
    tipoDano: 'NEVERA' | 'PIJAMA',
    monto: Decimal,
  ): Promise<Equipamiento> {
    // Aumenta la deuda y marca el componente como dañado
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        deudaDano: { increment: Number.parseFloat(monto.toFixed(2)) },
        ...(tipoDano === 'NEVERA' ? { neveraDanada: true } : { pijamaDanada: true }),
      },
    });
  }

  async transicionarAPerdidoPorDanos(id: string, montoPerdida: Decimal): Promise<Equipamiento> {
    // Cuando ambos componentes están dañados: estado → PERDIDO,
    // deudaDano → 0 (absorbida en deudaPerdida que cubre el total)
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        estado: 'PERDIDO',
        neveraDanada: true,
        pijamaDanada: true,
        deudaDano: '0',
        deudaPerdida: montoPerdida.toFixed(2),
      },
    });
  }

  async reportarPerdida(id: string, monto: Decimal): Promise<Equipamiento> {
    // Cambia estado a PERDIDO y registra la deuda total
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        estado: 'PERDIDO',
        neveraDanada: true,
        pijamaDanada: true,
        deudaPerdida: monto.toFixed(2),
      },
    });
  }

  async devolver(id: string): Promise<Equipamiento> {
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        estado: 'DEVUELTO',
        fechaDevolucion: new Date(),
      },
    });
  }

  async devolverDeposito(id: string): Promise<Equipamiento> {
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        depositoDevuelto: true,
        fechaDevolucionDeposito: new Date(),
      },
    });
  }

  async registrarPagoMensualidad(id: string): Promise<Equipamiento> {
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        ultimaMensualidadPagada: new Date(),
      },
    });
  }

  async reducirDeudaDano(id: string, monto: Decimal): Promise<Equipamiento> {
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        deudaDano: { decrement: Number.parseFloat(monto.toFixed(2)) },
      },
    });
  }

  async reducirDeudaPerdida(id: string, monto: Decimal): Promise<Equipamiento> {
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        deudaPerdida: { decrement: Number.parseFloat(monto.toFixed(2)) },
      },
    });
  }
}
