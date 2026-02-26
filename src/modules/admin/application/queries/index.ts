import { QueryHandler, IQueryHandler, IQuery } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IPedidoStockRepository,
  PEDIDO_STOCK_REPOSITORY,
  IConfiguracionRepository,
  CONFIGURACION_REPOSITORY,
  ITipoInsumoRepository,
  TIPO_INSUMO_REPOSITORY,
  IStockAdminRepository,
  STOCK_ADMIN_REPOSITORY,
} from '../../domain/repositories';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { DomainException } from '../../../../domain/exceptions/domain.exception';
import {
  PedidoStockResponseDto,
  ConfiguracionResponseDto,
  TipoInsumoResponseDto,
  StockAdminResponseDto,
  DeficitResponseDto,
  StockReservadoDetalladoDto,
  StockPorEstadoDto,
  StockReservadoPorVendedorDto,
  StockReservadoPorLoteDto,
  ResumenDashboardDto,
  VentasPeriodoDto,
  CuadrePendienteResumenDto,
  VendedoresActivosDetalleDto,
} from '../dto';

// ========== ObtenerPedidoStockQuery ==========

export class ObtenerPedidoStockQuery implements IQuery {
  constructor(public readonly pedidoId: string) {}
}

@QueryHandler(ObtenerPedidoStockQuery)
export class ObtenerPedidoStockHandler implements IQueryHandler<
  ObtenerPedidoStockQuery,
  PedidoStockResponseDto
> {
  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(query: ObtenerPedidoStockQuery): Promise<PedidoStockResponseDto> {
    const pedido = await this.pedidoRepository.findById(query.pedidoId);
    if (!pedido) {
      throw new DomainException('PED_006', 'Pedido no encontrado');
    }

    return {
      id: pedido.id,
      cantidadTrabix: pedido.cantidadTrabix,
      estado: pedido.estado,
      costoTotal: Number.parseFloat(pedido.costoTotal.toString()),
      costoRealPorTrabix: Number.parseFloat(pedido.costoRealPorTrabix.toString()),
      detallesCosto: pedido.detallesCosto.map((d) => ({
        id: d.id,
        concepto: d.concepto,
        esObligatorio: d.esObligatorio,
        cantidad: d.cantidad,
        costoTotal: Number.parseFloat(d.costoTotal.toString()),
        fechaRegistro: d.fechaRegistro,
      })),
      fechaCreacion: pedido.fechaCreacion,
      fechaCancelacion: pedido.fechaCancelacion,
      motivoCancelacion: pedido.motivoCancelacion,
      notas: pedido.notas,
    };
  }
}

// ========== ListarPedidosStockQuery ==========

export class ListarPedidosStockQuery implements IQuery {
  constructor(
    public readonly estado?: string,
    public readonly skip?: number,
    public readonly take?: number,
  ) {}
}

@QueryHandler(ListarPedidosStockQuery)
export class ListarPedidosStockHandler implements IQueryHandler<ListarPedidosStockQuery> {
  constructor(
    @Inject(PEDIDO_STOCK_REPOSITORY)
    private readonly pedidoRepository: IPedidoStockRepository,
  ) {}

  async execute(query: ListarPedidosStockQuery): Promise<any> {
    const resultado = await this.pedidoRepository.findAll({
      estado: query.estado as any,
      skip: query.skip,
      take: query.take,
    });

    return {
      data: resultado.data.map((p) => ({
        id: p.id,
        cantidadTrabix: p.cantidadTrabix,
        estado: p.estado,
        costoTotal: Number.parseFloat(p.costoTotal.toString()),
        costoRealPorTrabix: Number.parseFloat(p.costoRealPorTrabix.toString()),
        detallesCosto: p.detallesCosto.map((d) => ({
          id: d.id,
          concepto: d.concepto,
          esObligatorio: d.esObligatorio,
          cantidad: d.cantidad,
          costoTotal: Number.parseFloat(d.costoTotal.toString()),
          fechaRegistro: d.fechaRegistro,
        })),
        fechaCreacion: p.fechaCreacion,
        fechaCancelacion: p.fechaCancelacion,
        motivoCancelacion: p.motivoCancelacion,
        notas: p.notas,
      })),
      total: resultado.total,
      hasMore: resultado.hasMore,
    };
  }
}

// ========== ListarConfiguracionesQuery ==========

export class ListarConfiguracionesQuery implements IQuery {
  constructor(public readonly categoria?: string) {}
}

@QueryHandler(ListarConfiguracionesQuery)
export class ListarConfiguracionesHandler implements IQueryHandler<
  ListarConfiguracionesQuery,
  ConfiguracionResponseDto[]
> {
  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly configuracionRepository: IConfiguracionRepository,
  ) {}

  async execute(query: ListarConfiguracionesQuery): Promise<ConfiguracionResponseDto[]> {
    const configs = query.categoria
      ? await this.configuracionRepository.findByCategoria(query.categoria)
      : await this.configuracionRepository.findAll();

    return configs.map((c) => ({
      id: c.id,
      clave: c.clave,
      valor: c.valor,
      tipo: c.tipo,
      descripcion: c.descripcion,
      categoria: c.categoria,
      modificable: c.modificable,
      ultimaModificacion: c.ultimaModificacion,
    }));
  }
}

// ========== ObtenerConfiguracionQuery ==========

export class ObtenerConfiguracionQuery implements IQuery {
  constructor(public readonly clave: string) {}
}

@QueryHandler(ObtenerConfiguracionQuery)
export class ObtenerConfiguracionHandler implements IQueryHandler<
  ObtenerConfiguracionQuery,
  ConfiguracionResponseDto
> {
  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly configuracionRepository: IConfiguracionRepository,
  ) {}

  async execute(query: ObtenerConfiguracionQuery): Promise<ConfiguracionResponseDto> {
    const config = await this.configuracionRepository.findByClave(query.clave);
    if (!config) {
      throw new DomainException('CFG_002', 'Configuración no encontrada');
    }

    return {
      id: config.id,
      clave: config.clave,
      valor: config.valor,
      tipo: config.tipo,
      descripcion: config.descripcion,
      categoria: config.categoria,
      modificable: config.modificable,
      ultimaModificacion: config.ultimaModificacion,
    };
  }
}

// ========== ObtenerHistorialConfiguracionQuery ==========

export class ObtenerHistorialConfiguracionQuery implements IQuery {
  constructor(
    public readonly clave?: string,
    public readonly skip?: number,
    public readonly take?: number,
  ) {}
}

@QueryHandler(ObtenerHistorialConfiguracionQuery)
export class ObtenerHistorialConfiguracionHandler implements IQueryHandler<ObtenerHistorialConfiguracionQuery> {
  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly configuracionRepository: IConfiguracionRepository,
  ) {}

  async execute(query: ObtenerHistorialConfiguracionQuery): Promise<any> {
    const resultado = await this.configuracionRepository.getHistorial({
      clave: query.clave,
      skip: query.skip,
      take: query.take,
    });

    return {
      data: resultado.data.map((h: any) => ({
        id: h.id,
        clave: h.clave,
        valorAnterior: h.valorAnterior,
        valorNuevo: h.valorNuevo,
        modificadoPorId: h.modificadoPorId,
        modificadoPorNombre: h.modificadoPor
          ? `${h.modificadoPor.nombre} ${h.modificadoPor.apellidos}`
          : null,
        motivo: h.motivo,
        fechaCambio: h.fechaCambio,
      })),
      total: resultado.total,
    };
  }
}

// ========== ListarTiposInsumoQuery ==========

export class ListarTiposInsumoQuery implements IQuery {
  constructor(public readonly activo?: boolean) {}
}

@QueryHandler(ListarTiposInsumoQuery)
export class ListarTiposInsumoHandler implements IQueryHandler<
  ListarTiposInsumoQuery,
  TipoInsumoResponseDto[]
> {
  constructor(
    @Inject(TIPO_INSUMO_REPOSITORY)
    private readonly tipoInsumoRepository: ITipoInsumoRepository,
  ) {}

  async execute(query: ListarTiposInsumoQuery): Promise<TipoInsumoResponseDto[]> {
    const tipos = await this.tipoInsumoRepository.findAll({
      activo: query.activo,
    });

    return tipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      esObligatorio: t.esObligatorio,
      activo: t.activo,
      fechaCreacion: t.fechaCreacion,
    }));
  }
}

// ========== ObtenerStockAdminQuery ==========

export class ObtenerStockAdminQuery implements IQuery {}

@QueryHandler(ObtenerStockAdminQuery)
export class ObtenerStockAdminHandler implements IQueryHandler<
  ObtenerStockAdminQuery,
  StockAdminResponseDto
> {
  constructor(
    @Inject(STOCK_ADMIN_REPOSITORY)
    private readonly stockAdminRepository: IStockAdminRepository,
  ) {}

  async execute(): Promise<StockAdminResponseDto> {
    const stock = await this.stockAdminRepository.get();

    return {
      stockFisico: stock?.stockFisico || 0,
      ultimoPedidoId: stock?.ultimoPedidoId,
      ultimaActualizacion: stock?.ultimaActualizacion || new Date(),
    };
  }
}

// ========== ObtenerDeficitQuery ==========

export class ObtenerDeficitQuery implements IQuery {}

@QueryHandler(ObtenerDeficitQuery)
export class ObtenerDeficitHandler implements IQueryHandler<
  ObtenerDeficitQuery,
  DeficitResponseDto
> {
  constructor(
    @Inject(STOCK_ADMIN_REPOSITORY)
    private readonly stockAdminRepository: IStockAdminRepository,
  ) {}

  async execute(): Promise<DeficitResponseDto> {
    const stock = await this.stockAdminRepository.get();
    const stockFisico = stock?.stockFisico || 0;
    const stockReservado = await this.stockAdminRepository.getStockReservado();
    const deficit = await this.stockAdminRepository.getDeficit();

    return {
      stockFisico,
      stockReservado,
      deficit,
      hayDeficit: deficit > 0,
    };
  }
}

// ========== ObtenerStockReservadoDetalladoQuery ==========

export class ObtenerStockReservadoDetalladoQuery implements IQuery {}

/**
 * Handler para obtener el desglose completo del stock reservado
 *
 * Stock reservado = TRABIX comprometidos pero que AÚN NO han llegado al vendedor
 * Funciona como un banco: el stock sigue siendo "del admin" hasta que llega EN_CASA
 *
 * Estados considerados como RESERVADO:
 * - INACTIVA: Tanda creada pero no liberada (comprometido)
 * - LIBERADA: Lista para enviar (sigue con admin)
 * - EN_TRANSITO: En camino al vendedor (sigue siendo del admin)
 *
 * Estados NO reservados:
 * - EN_CASA: Ya está físicamente con el vendedor
 * - FINALIZADA: Ya se liquidó
 *
 * El desglose incluye:
 * - Por estado de tanda (cuánto en cada estado)
 * - Por vendedor (cuánto tiene comprometido cada vendedor)
 * - Por lote (detalle de cada lote con sus tandas pendientes)
 */
@QueryHandler(ObtenerStockReservadoDetalladoQuery)
export class ObtenerStockReservadoDetalladoHandler implements IQueryHandler<
  ObtenerStockReservadoDetalladoQuery,
  StockReservadoDetalladoDto
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<StockReservadoDetalladoDto> {
    // Estados que consideramos como "stock reservado" (aún no entregado al vendedor)
    const estadosReservados = ['INACTIVA', 'LIBERADA', 'EN_TRANSITO'];

    // 1. Obtener todas las tandas en estados reservados
    const tandas = await this.prisma.tanda.findMany({
      where: {
        estado: { in: estadosReservados as any },
      },
      include: {
        lote: {
          include: {
            vendedor: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
              },
            },
          },
        },
      },
    });

    // 2. Calcular desglose por estado
    const porEstado: StockPorEstadoDto = {
      inactiva: 0,
      liberada: 0,
      enTransito: 0,
    };

    for (const tanda of tandas) {
      switch (tanda.estado) {
        case 'INACTIVA':
          porEstado.inactiva += tanda.stockActual;
          break;
        case 'LIBERADA':
          porEstado.liberada += tanda.stockActual;
          break;
        case 'EN_TRANSITO':
          porEstado.enTransito += tanda.stockActual;
          break;
      }
    }

    // 3. Calcular desglose por vendedor
    const vendedorMap = new Map<
      string,
      {
        vendedorId: string;
        vendedorNombre: string;
        cantidadReservada: number;
        lotesActivos: Set<string>;
      }
    >();

    for (const tanda of tandas) {
      const vendedor = tanda.lote.vendedor;
      const key = vendedor.id;

      if (!vendedorMap.has(key)) {
        vendedorMap.set(key, {
          vendedorId: vendedor.id,
          vendedorNombre: `${vendedor.nombre} ${vendedor.apellidos}`,
          cantidadReservada: 0,
          lotesActivos: new Set(),
        });
      }

      const data = vendedorMap.get(key)!;
      data.cantidadReservada += tanda.stockActual;
      data.lotesActivos.add(tanda.loteId);
    }

    const porVendedor: StockReservadoPorVendedorDto[] = Array.from(vendedorMap.values())
      .map((v) => ({
        vendedorId: v.vendedorId,
        vendedorNombre: v.vendedorNombre,
        cantidadReservada: v.cantidadReservada,
        lotesActivos: v.lotesActivos.size,
      }))
      .sort((a, b) => b.cantidadReservada - a.cantidadReservada);

    // 4. Calcular desglose por lote
    const loteMap = new Map<
      string,
      {
        loteId: string;
        vendedorId: string;
        vendedorNombre: string;
        cantidadTrabix: number;
        stockPendiente: number;
        estadoLote: string;
        tandas: {
          tandaId: string;
          numero: number;
          estado: string;
          stockActual: number;
        }[];
      }
    >();

    for (const tanda of tandas) {
      const lote = tanda.lote;
      const key = lote.id;

      if (!loteMap.has(key)) {
        loteMap.set(key, {
          loteId: lote.id,
          vendedorId: lote.vendedor.id,
          vendedorNombre: `${lote.vendedor.nombre} ${lote.vendedor.apellidos}`,
          cantidadTrabix: lote.cantidadTrabix,
          stockPendiente: 0,
          estadoLote: lote.estado,
          tandas: [],
        });
      }

      const data = loteMap.get(key)!;
      data.stockPendiente += tanda.stockActual;
      data.tandas.push({
        tandaId: tanda.id,
        numero: tanda.numero,
        estado: tanda.estado,
        stockActual: tanda.stockActual,
      });
    }

    const porLote: StockReservadoPorLoteDto[] = Array.from(loteMap.values())
      .map((l) => ({
        ...l,
        tandas: l.tandas.sort((a, b) => a.numero - b.numero),
      }))
      .sort((a, b) => b.stockPendiente - a.stockPendiente);

    // 5. Calcular total
    const totalReservado = porEstado.inactiva + porEstado.liberada + porEstado.enTransito;

    return {
      totalReservado,
      porEstado,
      porVendedor,
      porLote,
    };
  }
}

// ========== ResumenDashboardQuery ==========

export class ResumenDashboardQuery implements IQuery {}

@QueryHandler(ResumenDashboardQuery)
export class ResumenDashboardHandler implements IQueryHandler<
  ResumenDashboardQuery,
  ResumenDashboardDto
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<ResumenDashboardDto> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [ventasHoy, cuadresPendientes, vendedoresActivos, stockAdmin, saldoFondo] =
      await Promise.all([
        // Ventas de hoy aprobadas
        this.prisma.venta.aggregate({
          _count: { _all: true },
          _sum: { montoTotal: true },
          where: {
            fechaRegistro: { gte: hoy },
          },
        }),
        // Cuadres pendientes
        this.prisma.cuadre.count({ where: { estado: 'PENDIENTE' } }),
        // Vendedores activos (VENDEDOR + RECLUTADOR)
        this.prisma.usuario.count({
          where: {
            rol: { in: ['VENDEDOR', 'RECLUTADOR'] },
            estado: 'ACTIVO',
            eliminado: false,
          },
        }),
        // Stock admin
        this.prisma.stockAdmin.findFirst(),
        // Saldo fondo de recompensas
        this.calcularSaldoFondo(),
      ]);

    return {
      ventasHoy: ventasHoy._count._all ?? 0,
      ingresosHoy: Number.parseFloat((ventasHoy._sum?.montoTotal || 0).toString()),
      stockFisico: stockAdmin?.stockFisico || 0,
      cuadresPendientes,
      vendedoresActivos,
      saldoFondo,
    };
  }

  private async calcularSaldoFondo(): Promise<number> {
    const entradas = await this.prisma.movimientoFondo.aggregate({
      _sum: { monto: true },
      where: { tipo: 'ENTRADA' },
    });
    const salidas = await this.prisma.movimientoFondo.aggregate({
      _sum: { monto: true },
      where: { tipo: 'SALIDA' },
    });

    const totalEntradas = new Decimal(entradas._sum.monto || 0);
    const totalSalidas = new Decimal(salidas._sum.monto || 0);

    return Number.parseFloat(totalEntradas.minus(totalSalidas).toFixed(2));
  }
}

// ========== VentasPeriodoQuery ==========

export class VentasPeriodoQuery implements IQuery {
  constructor(public readonly periodo: 'dia' | 'semana' | 'mes') {}
}

@QueryHandler(VentasPeriodoQuery)
export class VentasPeriodoHandler implements IQueryHandler<VentasPeriodoQuery, VentasPeriodoDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: VentasPeriodoQuery): Promise<VentasPeriodoDto> {
    const fechaInicio = this.calcularFechaInicio(query.periodo);

    const resultado = await this.prisma.venta.aggregate({
      _count: { _all: true },
      _sum: { montoTotal: true, cantidadTrabix: true },
      where: {
        fechaRegistro: { gte: fechaInicio },
      },
    });

    return {
      periodo: query.periodo,
      totalVentas: resultado._count?._all ?? 0,
      totalIngresos: Number.parseFloat((resultado._sum?.montoTotal ?? 0).toString()),
      trabixVendidos: resultado._sum?.cantidadTrabix ?? 0,
    };
  }

  private calcularFechaInicio(periodo: string): Date {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);

    switch (periodo) {
      case 'dia':
        return fecha;
      case 'semana':
        fecha.setDate(fecha.getDate() - 7);
        return fecha;
      case 'mes':
        fecha.setMonth(fecha.getMonth() - 1);
        return fecha;
      default:
        return fecha;
    }
  }
}

// ========== VendedoresActivosQuery ==========

export class VendedoresActivosQuery implements IQuery {}

@QueryHandler(VendedoresActivosQuery)
export class VendedoresActivosHandler implements IQueryHandler<
  VendedoresActivosQuery,
  VendedoresActivosDetalleDto
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<VendedoresActivosDetalleDto> {
    const [vendedores, reclutadores] = await Promise.all([
      this.prisma.usuario.count({
        where: { rol: 'VENDEDOR', estado: 'ACTIVO', eliminado: false },
      }),
      this.prisma.usuario.count({
        where: { rol: 'RECLUTADOR', estado: 'ACTIVO', eliminado: false },
      }),
    ]);

    return {
      total: vendedores + reclutadores,
      vendedores,
      reclutadores,
    };
  }
}

// ========== CuadresPendientesQuery ==========

export class CuadresPendientesQuery implements IQuery {}

@QueryHandler(CuadresPendientesQuery)
export class CuadresPendientesHandler implements IQueryHandler<
  CuadresPendientesQuery,
  CuadrePendienteResumenDto[]
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<CuadrePendienteResumenDto[]> {
    const cuadres = await this.prisma.cuadre.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        tanda: {
          include: {
            lote: {
              include: {
                vendedor: { select: { nombre: true, apellidos: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaPendiente: 'asc' },
    });

    return cuadres.map((c) => ({
      cuadreId: c.id,
      tandaId: c.tandaId,
      numeroTanda: c.tanda.numero,
      vendedorNombre: `${c.tanda.lote.vendedor.nombre} ${c.tanda.lote.vendedor.apellidos}`,
      montoEsperado: Number.parseFloat(c.montoEsperado.toString()),
      fechaPendiente: c.fechaPendiente!,
    }));
  }
}

// Export handlers array
export const AdminQueryHandlers = [
  ObtenerPedidoStockHandler,
  ListarPedidosStockHandler,
  ListarConfiguracionesHandler,
  ObtenerConfiguracionHandler,
  ObtenerHistorialConfiguracionHandler,
  ListarTiposInsumoHandler,
  ObtenerStockAdminHandler,
  ObtenerDeficitHandler,
  ObtenerStockReservadoDetalladoHandler,
  ResumenDashboardHandler,
  VentasPeriodoHandler,
  VendedoresActivosHandler,
  CuadresPendientesHandler,
];
