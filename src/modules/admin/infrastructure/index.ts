import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  EstadoPedidoStock,
  PedidoStock,
  DetalleCostoPedido,
  ConfiguracionSistema,
  HistorialConfiguracion,
  TipoInsumo,
  StockAdmin,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  IPedidoStockRepository,
  CreatePedidoStockData,
  UpdatePedidoStockData,
  CreateDetalleCostoData,
  PedidoStockWithDetalles,
  IConfiguracionRepository,
  HistorialOptions,
  RegistrarHistorialData,
  ITipoInsumoRepository,
  CreateTipoInsumoData,
  IStockAdminRepository,
} from '../domain/repositories';

// ========== PedidoStock Repository ==========

@Injectable()
export class PrismaPedidoStockRepository implements IPedidoStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PedidoStockWithDetalles | null> {
    return this.prisma.pedidoStock.findUnique({
      where: { id },
      include: { detallesCosto: { orderBy: { fechaRegistro: 'asc' } } },
    });
  }

  async findAll(options?: { estado?: EstadoPedidoStock; skip?: number; take?: number }): Promise<{
    data: PedidoStockWithDetalles[];
    total: number;
    hasMore: boolean;
  }> {
    const { estado, skip = 0, take = 20 } = options || {};
    const where = estado ? { estado } : {};

    const [data, total] = await Promise.all([
      this.prisma.pedidoStock.findMany({
        where,
        include: { detallesCosto: { orderBy: { fechaRegistro: 'asc' } } },
        skip,
        take: take + 1,
        orderBy: [{ estado: 'asc' }, { fechaCreacion: 'desc' }],
      }),
      this.prisma.pedidoStock.count({ where }),
    ]);

    const hasMore = data.length > take;
    if (hasMore) data.pop();

    return { data, total, hasMore };
  }

  async create(data: CreatePedidoStockData): Promise<PedidoStock> {
    return this.prisma.pedidoStock.create({
      data: {
        cantidadTrabix: data.cantidadTrabix,
        notas: data.notas,
        estado: 'BORRADOR',
      },
    });
  }

  async update(id: string, data: UpdatePedidoStockData): Promise<PedidoStock> {
    const updateData: any = {};
    if (data.cantidadTrabix !== undefined) {
      updateData.cantidadTrabix = data.cantidadTrabix;
    }
    if (data.notas !== undefined) {
      updateData.notas = data.notas;
    }

    return this.prisma.pedidoStock.update({
      where: { id },
      data: updateData,
    });
  }

  async agregarCosto(data: CreateDetalleCostoData): Promise<DetalleCostoPedido> {
    return this.prisma.detalleCostoPedido.create({
      data: {
        pedidoId: data.pedidoId,
        concepto: data.concepto,
        esObligatorio: data.esObligatorio,
        cantidad: data.cantidad,
        costoTotal: data.costoTotal.toFixed(2),
      },
    });
  }

  async eliminarCosto(costoId: string): Promise<void> {
    await this.prisma.detalleCostoPedido.delete({ where: { id: costoId } });
  }

  async recibir(
    id: string,
    costoTotal: Decimal,
    costoRealPorTrabix: Decimal,
  ): Promise<PedidoStock> {
    return this.prisma.pedidoStock.update({
      where: { id },
      data: {
        estado: 'RECIBIDO',
        costoTotal: costoTotal.toFixed(2),
        costoRealPorTrabix: costoRealPorTrabix.toFixed(2),
        fechaRecepcion: new Date(),
      },
    });
  }
}

// ========== Configuracion Repository ==========

@Injectable()
export class PrismaConfiguracionRepository implements IConfiguracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByClave(clave: string): Promise<ConfiguracionSistema | null> {
    return this.prisma.configuracionSistema.findUnique({ where: { clave } });
  }

  async findByCategoria(categoria: string): Promise<ConfiguracionSistema[]> {
    return this.prisma.configuracionSistema.findMany({
      where: { categoria },
      orderBy: { clave: 'asc' },
    });
  }

  async findAll(): Promise<ConfiguracionSistema[]> {
    return this.prisma.configuracionSistema.findMany({
      orderBy: [{ categoria: 'asc' }, { clave: 'asc' }],
    });
  }

  async actualizar(
    clave: string,
    valor: string,
    modificadoPorId: string,
  ): Promise<ConfiguracionSistema> {
    return this.prisma.configuracionSistema.update({
      where: { clave },
      data: {
        valor,
        modificadoPorId,
        ultimaModificacion: new Date(),
      },
    });
  }

  async getHistorial(options?: HistorialOptions): Promise<{
    data: HistorialConfiguracion[];
    total: number;
  }> {
    const { clave, skip = 0, take = 50 } = options || {};
    const where = clave ? { clave } : {};

    const [data, total] = await Promise.all([
      this.prisma.historialConfiguracion.findMany({
        where,
        skip,
        take,
        orderBy: { fechaCambio: 'desc' },
        include: {
          modificadoPor: {
            select: { id: true, nombre: true, apellidos: true },
          },
        },
      }),
      this.prisma.historialConfiguracion.count({ where }),
    ]);

    return { data, total };
  }

  async registrarHistorial(data: RegistrarHistorialData): Promise<HistorialConfiguracion> {
    return this.prisma.historialConfiguracion.create({ data });
  }
}

// ========== TipoInsumo Repository ==========

@Injectable()
export class PrismaTipoInsumoRepository implements ITipoInsumoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TipoInsumo | null> {
    return this.prisma.tipoInsumo.findUnique({ where: { id } });
  }

  async findByNombre(nombre: string): Promise<TipoInsumo | null> {
    return this.prisma.tipoInsumo.findUnique({ where: { nombre } });
  }

  async findAll(): Promise<TipoInsumo[]> {
    return this.prisma.tipoInsumo.findMany({
      orderBy: [{ esObligatorio: 'desc' }, { nombre: 'asc' }],
    });
  }

  async findObligatorios(): Promise<TipoInsumo[]> {
    return this.prisma.tipoInsumo.findMany({
      where: { esObligatorio: true },
    });
  }

  async create(data: CreateTipoInsumoData): Promise<TipoInsumo> {
    return this.prisma.tipoInsumo.create({
      data: {
        nombre: data.nombre,
        esObligatorio: data.esObligatorio || false,
      },
    });
  }

  async update(id: string, data: Partial<CreateTipoInsumoData>): Promise<TipoInsumo> {
    return this.prisma.tipoInsumo.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tipoInsumo.delete({ where: { id } });
  }
}

// ========== StockAdmin Repository ==========

@Injectable()
export class PrismaStockAdminRepository implements IStockAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<StockAdmin | null> {
    return this.prisma.stockAdmin.findFirst();
  }

  async incrementarStock(cantidad: number, pedidoId: string): Promise<StockAdmin> {
    const stock = await this.get();
    if (!stock) {
      return this.prisma.stockAdmin.create({
        data: {
          stockFisico: cantidad,
          ultimoPedidoId: pedidoId,
        },
      });
    }

    return this.prisma.stockAdmin.update({
      where: { id: stock.id },
      data: {
        stockFisico: { increment: cantidad },
        ultimoPedidoId: pedidoId,
        ultimaActualizacion: new Date(),
      },
    });
  }

  async decrementarStock(cantidad: number): Promise<StockAdmin> {
    const stock = await this.get();
    if (!stock) {
      throw new Error('Stock admin no inicializado');
    }

    return this.prisma.stockAdmin.update({
      where: { id: stock.id },
      data: {
        stockFisico: { decrement: cantidad },
        ultimaActualizacion: new Date(),
      },
    });
  }

  /**
   * Calcula el stock reservado (comprometido pero NO entregado al vendedor)
   * Incluye tandas en estados: INACTIVA, EN_TRANSITO
   * Una vez EN_CASA, ya no es stock reservado (salió del "banco" del admin)
   */
  async getStockReservado(): Promise<number> {
    const result = await this.prisma.tanda.aggregate({
      _sum: { stockActual: true },
      where: {
        estado: { in: ['INACTIVA', 'EN_TRANSITO'] },
      },
    });
    return result._sum.stockActual || 0;
  }

  /**
   * Calcula el déficit (stock comprometido que excede el stock físico)
   * Déficit = Stock Reservado - Stock Físico (si es positivo)
   */
  async getDeficit(): Promise<number> {
    const stock = await this.get();
    const stockFisico = stock?.stockFisico || 0;
    const stockReservado = await this.getStockReservado();

    const deficit = stockReservado - stockFisico;
    return Math.max(deficit, 0);
  }
}
