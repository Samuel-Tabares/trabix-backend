import { Injectable } from '@nestjs/common';
import { TipoFuenteStock, FuenteStock } from './venta-mayor.entity';

/**
 * Información de tanda para consumo de stock
 */
export interface TandaParaConsumo {
  id: string;
  loteId: string;
  numero: number;
  stockActual: number;
  stockInicial: number;
  estado: string;
}

/**
 * Información de lote para consumo de stock
 */
export interface LoteParaConsumo {
  id: string;
  cantidadTrabix: number;
  estado: string;
  fechaActivacion: Date | null;
  tandas: TandaParaConsumo[];
}

/**
 * Stock disponible para venta al mayor
 */
export interface StockDisponible {
  stockReservado: number; // Tandas 2 y 3 (INACTIVAS)
  stockEnCasa: number; // Tandas EN_CASA
  stockTotal: number;
  necesitaLoteForzado: boolean;
  cantidadLoteForzado: number;
  detalle: DetalleStockDisponible[];
}

/**
 * Detalle de stock por tanda
 */
export interface DetalleStockDisponible {
  tandaId: string;
  loteId: string;
  numero: number;
  stockDisponible: number;
  tipoStock: TipoFuenteStock;
}

/**
 * Plan de consumo de stock
 */
export interface PlanConsumoStock {
  fuentesStock: FuenteStock[];
  lotesInvolucrados: string[];
  necesitaLoteForzado: boolean;
  cantidadLoteForzado: number;
  stockTotalConsumido: number;
}

/**
 * Domain Service: Consumidor de Stock para Venta al Mayor
 * Según sección 7.3 del documento
 *
 * Orden estricto de consumo:
 * 1. Stock reservado (tandas 2 y 3 inactivas)
 * 2. Stock en casa (si el reservado no alcanza)
 * 3. Creación de lote forzado (si ninguno alcanza)
 *
 * El stock reservado se descuenta en orden: tanda 2 primero, luego tanda 3
 * Los lotes se consumen en orden de antigüedad (el más antiguo primero)
 */
@Injectable()
export class ConsumidorStockMayorService {
  /**
   * Calcula el stock disponible para venta al mayor
   */
  calcularStockDisponible(lotes: LoteParaConsumo[]): StockDisponible {
    const detalle: DetalleStockDisponible[] = [];
    let stockReservado = 0;
    let stockEnCasa = 0;

    // Ordenar lotes por antigüedad (fecha de activación más antigua primero)
    const lotesOrdenados = [...lotes]
      .filter((l) => l.estado === 'ACTIVO')
      .sort((a, b) => {
        const fechaA = a.fechaActivacion?.getTime() || 0;
        const fechaB = b.fechaActivacion?.getTime() || 0;
        return fechaA - fechaB;
      });

    for (const lote of lotesOrdenados) {
      // Ordenar tandas por número (2, 3 primero para reservado)
      const tandasOrdenadas = [...lote.tandas].sort((a, b) => a.numero - b.numero);

      for (const tanda of tandasOrdenadas) {
        if (tanda.stockActual <= 0) continue;

        if (tanda.estado === 'INACTIVA') {
          // Stock reservado (tandas 2 y 3)
          stockReservado += tanda.stockActual;
          detalle.push({
            tandaId: tanda.id,
            loteId: lote.id,
            numero: tanda.numero,
            stockDisponible: tanda.stockActual,
            tipoStock: 'RESERVADO',
          });
        } else if (tanda.estado === 'EN_CASA') {
          // Stock en casa
          stockEnCasa += tanda.stockActual;
          detalle.push({
            tandaId: tanda.id,
            loteId: lote.id,
            numero: tanda.numero,
            stockDisponible: tanda.stockActual,
            tipoStock: 'EN_CASA',
          });
        }
      }
    }

    const stockTotal = stockReservado + stockEnCasa;

    return {
      stockReservado,
      stockEnCasa,
      stockTotal,
      necesitaLoteForzado: false,
      cantidadLoteForzado: 0,
      detalle,
    };
  }

  /**
   * Genera un plan de consumo de stock para una cantidad específica
   */
  generarPlanConsumo(cantidadRequerida: number, lotes: LoteParaConsumo[]): PlanConsumoStock {
    const fuentesStock: FuenteStock[] = [];
    const lotesInvolucrados = new Set<string>();

    let cantidadRestante = cantidadRequerida;

    // Ordenar lotes activos por antigüedad
    const lotesOrdenados = this.ordenarLotesActivosPorFecha(lotes);

    // PASO 1: Consumir stock reservado (tandas INACTIVAS)
    cantidadRestante = this.consumirPorTipoStock({
      lotes: lotesOrdenados,
      cantidadRestante,
      estadoTanda: 'INACTIVA',
      tipoStock: 'RESERVADO',
      fuentesStock,
      lotesInvolucrados,
    });

    // PASO 2: Consumir stock en casa si aún falta
    if (cantidadRestante > 0) {
      cantidadRestante = this.consumirPorTipoStock({
        lotes: lotesOrdenados,
        cantidadRestante,
        estadoTanda: 'EN_CASA',
        tipoStock: 'EN_CASA',
        fuentesStock,
        lotesInvolucrados,
      });
    }

    // PASO 3: Determinar si se requiere lote forzado
    const necesitaLoteForzado = cantidadRestante > 0;

    return {
      fuentesStock,
      lotesInvolucrados: Array.from(lotesInvolucrados),
      necesitaLoteForzado,
      cantidadLoteForzado: necesitaLoteForzado ? cantidadRestante : 0,
      stockTotalConsumido: cantidadRequerida - cantidadRestante,
    };
  }

  /* ===================== HELPERS ===================== */

  // Ordena lotes activos por fecha de activación
  private ordenarLotesActivosPorFecha(lotes: LoteParaConsumo[]): LoteParaConsumo[] {
    return [...lotes]
      .filter((l) => l.estado === 'ACTIVO')
      .sort((a, b) => {
        const fechaA = a.fechaActivacion?.getTime() ?? 0;
        const fechaB = b.fechaActivacion?.getTime() ?? 0;
        return fechaA - fechaB;
      });
  }

  // Consume stock de tandas según estado y tipo
  private consumirPorTipoStock(params: {
    lotes: LoteParaConsumo[];
    cantidadRestante: number;
    estadoTanda: 'INACTIVA' | 'EN_CASA';
    tipoStock: 'RESERVADO' | 'EN_CASA';
    fuentesStock: FuenteStock[];
    lotesInvolucrados: Set<string>;
  }): number {
    let restante = params.cantidadRestante;

    for (const lote of params.lotes) {
      if (restante <= 0) break;

      const tandas = lote.tandas
        .filter((t) => t.estado === params.estadoTanda && t.stockActual > 0)
        .sort((a, b) => a.numero - b.numero);

      for (const tanda of tandas) {
        if (restante <= 0) break;

        const consumir = Math.min(tanda.stockActual, restante);

        params.fuentesStock.push({
          tandaId: tanda.id,
          cantidadConsumida: consumir,
          tipoStock: params.tipoStock,
        });

        params.lotesInvolucrados.add(lote.id);
        restante -= consumir;
      }
    }

    return restante;
  }
}
