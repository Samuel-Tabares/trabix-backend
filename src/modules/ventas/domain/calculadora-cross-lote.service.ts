import { Injectable } from '@nestjs/common';
import { TipoVenta } from '@prisma/client';
import { DetalleVentaParaCalculo } from './calculadora-precios-venta.service';

/**
 * Ítem de venta con trabix resueltos (puede ser PROMO_PARCIAL generado por el sistema)
 */
export interface ItemCrossLote {
  tipo: TipoVenta;
  cantidad: number;
}

/**
 * Resultado de la división cross-lote
 */
export interface ResultadoCrossLote {
  itemsLote1: ItemCrossLote[]; // Ítems que consumen el stock restante del lote 1
  itemsLote2: ItemCrossLote[]; // Ítems que van al tanda EN_CASA del lote 2
  trabixLote1: number;
  trabixLote2: number;
}

/**
 * Domain Service: CalculadoraCrossLote
 *
 * Calcula cómo dividir óptimamente los ítems de una venta cuando
 * el stock del lote actual (lote1) es insuficiente y el excedente
 * debe ir al siguiente lote activo (lote2).
 *
 * Prioridades para minimizar splits:
 *  A. No-promos solos llenan S → sin split, promos van intactas a lote2
 *  B. Promos solas llenan S (S par) → sin split, nonPromos van a lote2
 *  C. Mezcla de no-promos + promos enteras cubre S → sin split
 *  D. Split inevitable → 1 PROMO_PARCIAL en cada lote
 */
@Injectable()
export class CalculadoraCrossLoteService {
  /**
   * Divide los ítems entre lote1 (stock restante) y lote2 (excedente).
   *
   * @param detalles  Ítems originales de la venta (solo PROMO, UNIDAD, SIN_LICOR, REGALO)
   * @param stockRestanteLote1  Trabix disponibles en la última tanda de lote1
   */
  calcular(detalles: DetalleVentaParaCalculo[], stockRestanteLote1: number): ResultadoCrossLote {
    const S = stockRestanteLote1;

    const promos = detalles.filter((d) => d.tipo === 'PROMO');
    const nonPromos = detalles.filter((d) => d.tipo !== 'PROMO');

    const totalNonPromoTrabix = nonPromos.reduce((s, d) => s + d.cantidad, 0);
    const totalPromos = promos.reduce((s, d) => s + d.cantidad, 0);

    // Opción A: no-promos solos llenan S → sin split, promos intactas a lote2
    if (totalNonPromoTrabix >= S) {
      return this.fillConNonPromos(nonPromos, promos, S);
    }

    // Opción B: promos solas llenan S (S debe ser par) → sin split, nonPromos a lote2
    if (S % 2 === 0 && totalPromos >= S / 2) {
      return this.fillConPromosEnteras(nonPromos, promos, S / 2);
    }

    // Opción C: mezcla de no-promos (todos) + promos enteras para el restante
    const remaining = S - totalNonPromoTrabix; // siempre > 0 porque opción A ya fue descartada
    if (remaining % 2 === 0 && totalPromos >= remaining / 2) {
      return this.fillConNonPromosYPromosEnteras(nonPromos, promos, remaining / 2);
    }

    // Opción D: split inevitable → partir 1 promo en 2 PROMO_PARCIAL
    return this.fillConSplit(nonPromos, promos, remaining, S);
  }

  /**
   * Opción A: distribuir nonPromos para cubrir exactamente S trabix.
   * Todas las promos van a lote2 intactas.
   */
  private fillConNonPromos(
    nonPromos: DetalleVentaParaCalculo[],
    promos: DetalleVentaParaCalculo[],
    S: number,
  ): ResultadoCrossLote {
    const lote1: ItemCrossLote[] = [];
    const lote2: ItemCrossLote[] = [];
    let filled = 0;

    for (const item of nonPromos) {
      const need = S - filled;
      if (need <= 0) {
        lote2.push({ tipo: item.tipo, cantidad: item.cantidad });
      } else if (item.cantidad <= need) {
        lote1.push({ tipo: item.tipo, cantidad: item.cantidad });
        filled += item.cantidad;
      } else {
        lote1.push({ tipo: item.tipo, cantidad: need });
        lote2.push({ tipo: item.tipo, cantidad: item.cantidad - need });
        filled = S;
      }
    }

    for (const p of promos) {
      lote2.push({ tipo: 'PROMO', cantidad: p.cantidad });
    }

    const trabixTotal = this.contarTrabix([...nonPromos, ...promos]);
    return { itemsLote1: lote1, itemsLote2: lote2, trabixLote1: S, trabixLote2: trabixTotal - S };
  }

  /**
   * Opción B: `promosEnterasLote1` promos enteras para lote1, todos los nonPromos a lote2.
   */
  private fillConPromosEnteras(
    nonPromos: DetalleVentaParaCalculo[],
    promos: DetalleVentaParaCalculo[],
    promosEnterasLote1: number,
  ): ResultadoCrossLote {
    const lote1: ItemCrossLote[] = [];
    const lote2: ItemCrossLote[] = [];

    // Todos los nonPromos → lote2
    for (const item of nonPromos) {
      lote2.push({ tipo: item.tipo, cantidad: item.cantidad });
    }

    let asignadas = 0;
    for (const p of promos) {
      const restante = promosEnterasLote1 - asignadas;
      if (restante <= 0) {
        lote2.push({ tipo: 'PROMO', cantidad: p.cantidad });
      } else if (p.cantidad <= restante) {
        lote1.push({ tipo: 'PROMO', cantidad: p.cantidad });
        asignadas += p.cantidad;
      } else {
        lote1.push({ tipo: 'PROMO', cantidad: restante });
        lote2.push({ tipo: 'PROMO', cantidad: p.cantidad - restante });
        asignadas = promosEnterasLote1;
      }
    }

    const trabixLote1 = promosEnterasLote1 * 2;
    const trabixTotal = this.contarTrabix([...nonPromos, ...promos]);
    return { itemsLote1: lote1, itemsLote2: lote2, trabixLote1, trabixLote2: trabixTotal - trabixLote1 };
  }

  /**
   * Opción C: todos los nonPromos + `promosEnterasLote1` promos enteras en lote1.
   * El resto de promos va a lote2.
   */
  private fillConNonPromosYPromosEnteras(
    nonPromos: DetalleVentaParaCalculo[],
    promos: DetalleVentaParaCalculo[],
    promosEnterasLote1: number,
  ): ResultadoCrossLote {
    const lote1: ItemCrossLote[] = [];
    const lote2: ItemCrossLote[] = [];

    for (const item of nonPromos) {
      lote1.push({ tipo: item.tipo, cantidad: item.cantidad });
    }

    let asignadas = 0;
    for (const p of promos) {
      const restante = promosEnterasLote1 - asignadas;
      if (restante <= 0) {
        lote2.push({ tipo: 'PROMO', cantidad: p.cantidad });
      } else if (p.cantidad <= restante) {
        lote1.push({ tipo: 'PROMO', cantidad: p.cantidad });
        asignadas += p.cantidad;
      } else {
        lote1.push({ tipo: 'PROMO', cantidad: restante });
        lote2.push({ tipo: 'PROMO', cantidad: p.cantidad - restante });
        asignadas = promosEnterasLote1;
      }
    }

    const nonPromoTrabix = nonPromos.reduce((s, d) => s + d.cantidad, 0);
    const trabixLote1 = nonPromoTrabix + promosEnterasLote1 * 2;
    const trabixTotal = this.contarTrabix([...nonPromos, ...promos]);
    return { itemsLote1: lote1, itemsLote2: lote2, trabixLote1, trabixLote2: trabixTotal - trabixLote1 };
  }

  /**
   * Opción D: `remaining` es impar → se parte 1 promo.
   * Lote1: todos los nonPromos + floor(remaining/2) promos enteras + 1 PROMO_PARCIAL
   * Lote2: 1 PROMO_PARCIAL + promos restantes
   */
  private fillConSplit(
    nonPromos: DetalleVentaParaCalculo[],
    promos: DetalleVentaParaCalculo[],
    remaining: number,
    S: number,
  ): ResultadoCrossLote {
    const lote1: ItemCrossLote[] = [];
    const lote2: ItemCrossLote[] = [];

    // Todos los nonPromos → lote1
    for (const item of nonPromos) {
      lote1.push({ tipo: item.tipo, cantidad: item.cantidad });
    }

    const promosEnterasNeed = Math.floor(remaining / 2);
    let promosAsignadas = 0;
    let splitHecho = false;

    for (const p of promos) {
      let cantidad = p.cantidad;

      // Asignar promos enteras a lote1 si aún faltan
      if (!splitHecho && promosAsignadas < promosEnterasNeed) {
        const tomar = Math.min(cantidad, promosEnterasNeed - promosAsignadas);
        if (tomar > 0) {
          lote1.push({ tipo: 'PROMO', cantidad: tomar });
          promosAsignadas += tomar;
          cantidad -= tomar;
        }
      }

      // Partir 1 promo cuando ya tenemos las enteras necesarias
      if (!splitHecho && promosAsignadas >= promosEnterasNeed && cantidad > 0) {
        lote1.push({ tipo: 'PROMO_PARCIAL', cantidad: 1 });
        lote2.push({ tipo: 'PROMO_PARCIAL', cantidad: 1 });
        splitHecho = true;
        cantidad -= 1;
      }

      // Lo que queda de esta promo → lote2
      if (cantidad > 0) {
        lote2.push({ tipo: 'PROMO', cantidad });
      }
    }

    const trabixTotal = this.contarTrabix([...nonPromos, ...promos]);
    return { itemsLote1: lote1, itemsLote2: lote2, trabixLote1: S, trabixLote2: trabixTotal - S };
  }

  private contarTrabix(items: DetalleVentaParaCalculo[]): number {
    return items.reduce((s, d) => s + d.cantidad * (d.tipo === 'PROMO' ? 2 : 1), 0);
  }
}
