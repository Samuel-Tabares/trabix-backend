import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoTanda, Tanda } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ITandaRepository } from '../domain/tanda.repository.interface';

/**
 * Implementación del repositorio de tandas con Prisma
 */
@Injectable()
export class PrismaTandaRepository implements ITandaRepository {
  private readonly tiempoAutoTransitoHoras: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Cargar tiempo de auto-tránsito desde configuración
    this.tiempoAutoTransitoHoras = this.configService.get<number>('tiempos.autoTransitoHoras') ?? 2;
  }

  async findById(id: string): Promise<Tanda | null> {
    return this.prisma.tanda.findUnique({
      where: { id },
    });
  }

  async findByLote(loteId: string): Promise<Tanda[]> {
    return this.prisma.tanda.findMany({
      where: { loteId },
      orderBy: { numero: 'asc' },
    });
  }

  async findTandaEnCasa(loteId: string): Promise<Tanda | null> {
    return this.prisma.tanda.findFirst({
      where: {
        loteId,
        estado: EstadoTanda.EN_CASA,
        stockActual: { gt: 0 },
      },
      orderBy: { numero: 'asc' },
    });
  }

  async findTandasParaTransicion(): Promise<Tanda[]> {
    // Calcular el tiempo límite basado en la configuración
    const tiempoLimiteMs = this.tiempoAutoTransitoHoras * 60 * 60 * 1000;
    const fechaLimite = new Date(Date.now() - tiempoLimiteMs);

    return this.prisma.tanda.findMany({
      where: {
        estado: 'LIBERADA',
        fechaLiberacion: {
          lte: fechaLimite,
        },
      },
    });
  }

  async liberar(id: string): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        estado: 'LIBERADA',
        fechaLiberacion: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async transicionarAEnTransito(id: string): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        estado: 'EN_TRANSITO',
        fechaEnTransito: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async confirmarEntrega(id: string): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        estado: EstadoTanda.EN_CASA,
        fechaEnCasa: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async finalizar(id: string): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        estado: 'FINALIZADA',
        fechaFinalizada: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async actualizarStock(id: string, nuevoStock: number): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        stockActual: nuevoStock,
        version: { increment: 1 },
      },
    });
  }

  async consumirStock(id: string, cantidad: number): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        stockActual: {
          decrement: cantidad,
        },
        version: { increment: 1 },
      },
    });
  }

  async actualizarStockConsumidoPorMayor(id: string, cantidad: number): Promise<Tanda> {
    return this.prisma.tanda.update({
      where: { id },
      data: {
        stockConsumidoPorMayor: {
          increment: cantidad,
        },
        version: { increment: 1 },
      },
    });
  }
}
