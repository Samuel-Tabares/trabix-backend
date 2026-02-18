import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

/**
 * Información del lote para cálculo del monto final
 */
export interface LoteParaCierre {
  id: string;
  dineroRecaudado: Decimal;
  dineroTransferido: Decimal;
  inversionAdmin: Decimal;
  inversionVendedor: Decimal;
}

/**
 * Resultado del cálculo del monto final
 */
export interface MontoFinalCierre {
  montoFinal: Decimal;
  hayGananciasRestantes: boolean;
}

/**
 * Domain Service: Cierre de Lote
 * Según sección 9.5 del documento
 *
 * Funciones del mini-cuadre:
 * - Cerrar lote (estado FINALIZADO)
 * - Consolidar recaudo final
 * - Transferir ganancias restantes (si existen)
 *
 * Restricciones (9.6):
 * - No libera tandas
 * - No habilita nuevos lotes
 * - Es requisito para que el lote pase a FINALIZADO
 */
@Injectable()
export class CierreLoteService {
  /**
   * Calcula el monto final del mini-cuadre
   *
   * El monto final representa las ganancias restantes que no han sido
   * transferidas a través de los cuadres normales o cuadre al mayor.
   *
   * Según sección 9.7: Si todoo fue cubierto por cuadre al mayor → monto_final = 0
   */
  calcularMontoFinal(lote: LoteParaCierre): MontoFinalCierre {
    // Calcular lo que falta por transferir
    const pendientePorTransferir = lote.dineroRecaudado.minus(lote.dineroTransferido);

    // Si ya se transfirió todoo o más, no hay monto final
    if (pendientePorTransferir.lessThanOrEqualTo(0)) {
      return {
        montoFinal: new Decimal(0),
        hayGananciasRestantes: false,
      };
    }

    // Las ganancias restantes son lo pendiente por transferir
    return {
      montoFinal: pendientePorTransferir,
      hayGananciasRestantes: true,
    };
  }
}
