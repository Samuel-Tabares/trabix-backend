import { Injectable } from '@nestjs/common';
import { Equipamiento } from '@prisma/client';
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

  async findAll(options: FindEquipamientosOptions): Promise<PaginatedEquipamientos> {
    const { skip = 0, take = 20, where } = options;

    const [data, total] = await Promise.all([
      this.prisma.equipamiento.findMany({
        where,
        skip,
        take: take + 1,
        orderBy: { fechaSolicitud: 'desc' },
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
      }),
      this.prisma.equipamiento.count({ where }),
    ]);

    const hasMore = data.length > take;
    if (hasMore) data.pop();

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
    _tipoDano: 'NEVERA' | 'PIJAMA',
    monto: Decimal,
  ): Promise<Equipamiento> {
    // Solo aumenta la deuda, NO cambia el estado
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        deudaDano: { increment: Number.parseFloat(monto.toFixed(2)) },
      },
    });
  }

  async reportarPerdida(id: string, monto: Decimal): Promise<Equipamiento> {
    // Cambia estado a PERDIDO y registra la deuda
    return this.prisma.equipamiento.update({
      where: { id },
      data: {
        estado: 'PERDIDO',
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
