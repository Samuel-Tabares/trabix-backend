import { Injectable } from '@nestjs/common';
import { TipoNotificacion } from '@prisma/client';

/**
 * Interface para contenido de notificación
 */
export interface NotificacionContent {
  titulo: string;
  mensaje: string;
  datos?: Record<string, unknown>;
}

/**
 * Datos para notificación de stock bajo
 */
interface StockBajoData {
  porcentaje?: number;
  stockActual?: number;
  [key: string]: unknown;
}

/**
 * Datos para notificación de cuadre pendiente
 */
interface CuadrePendienteData {
  montoEsperado?: number;
  cuadreId?: string;
  [key: string]: unknown;
}

/**
 * Datos para notificación de cuadre exitoso
 */
interface CuadreExitosoData {
  montoTransferido?: number;
  cuadreId?: string;
  esVentaAlMayor?: boolean;
  [key: string]: unknown;
}

/**
 * Datos para notificación de tanda liberada
 */
interface TandaLiberadaData {
  numeroTanda?: number;
  cantidad?: number;
  loteId?: string;
  [key: string]: unknown;
}

/**
 * Datos para notificación manual
 */
interface ManualData {
  titulo?: string;
  mensaje?: string;
  [key: string]: unknown;
}

/**
 * Datos para notificación de premio recibido
 */
interface PremioRecibidoData {
  monto?: number;
  motivo?: string;
  concepto?: string;
  [key: string]: unknown;
}

/**
 * Datos para notificación de lote activado
 */
interface LoteActivadoData {
  loteId?: string;
  cantidadTrabix?: number;
  numeroTandas?: number;
  [key: string]: unknown;
}

/**
 * Datos para notificación de lote finalizado
 */
interface LoteFinalizadoData {
  loteId?: string;
  montoFinal?: number;
  [key: string]: unknown;
}

/**
 * Datos para notificación de equipamiento solicitado
 */
interface EquipamientoSolicitadoData {
  vendedorNombre?: string;
  tieneDeposito?: boolean;
  esParaAdmin?: boolean;
  [key: string]: unknown;
}

/**
 * Datos para notificación de equipamiento entregado
 */
interface EquipamientoEntregadoData {
  equipamientoId?: string;
  [key: string]: unknown;
}

/**
 * Datos para notificación de egreso del fondo
 */
interface FondoEgresoData {
  monto?: number;
  concepto?: string;
  beneficiarioNombre?: string;
  [key: string]: unknown;
}

/**
 * Factory para crear contenido de notificaciones
 * Según Factory Pattern del documento
 *
 * Cada tipo de notificación tiene su propio formato de contenido
 */
@Injectable()
export class NotificationContentFactory {
  /**
   * Crea el contenido de una notificación según su tipo
   */
  create(tipo: TipoNotificacion, datos: Record<string, unknown>): NotificacionContent {
    switch (tipo) {
      case 'STOCK_BAJO':
        return this.createStockBajo(datos as StockBajoData);
      case 'CUADRE_PENDIENTE':
        return this.createCuadrePendiente(datos as CuadrePendienteData);
      case 'INVERSION_RECUPERADA':
        return this.createInversionRecuperada(datos);
      case 'CUADRE_EXITOSO':
        return this.createCuadreExitoso(datos as CuadreExitosoData);
      case 'TANDA_LIBERADA':
        return this.createTandaLiberada(datos as TandaLiberadaData);
      case 'PREMIO_RECIBIDO':
        return this.createPremioRecibido(datos as PremioRecibidoData);
      case 'LOTE_ACTIVADO':
        return this.createLoteActivado(datos as LoteActivadoData);
      case 'LOTE_FINALIZADO':
        return this.createLoteFinalizado(datos as LoteFinalizadoData);
      case 'EQUIPAMIENTO_SOLICITADO':
        return this.createEquipamientoSolicitado(datos as EquipamientoSolicitadoData);
      case 'EQUIPAMIENTO_ENTREGADO':
        return this.createEquipamientoEntregado(datos as EquipamientoEntregadoData);
      case 'FONDO_EGRESO':
        return this.createFondoEgreso(datos as FondoEgresoData);
      case 'MANUAL':
        return this.createManual(datos as ManualData);
      default:
        return this.createGeneric(datos as ManualData);
    }
  }

  private createStockBajo(datos: StockBajoData): NotificacionContent {
    const porcentaje = datos.porcentaje ?? 25;
    return {
      titulo: '⚠️ Stock Bajo',
      mensaje: `Tu stock está al ${porcentaje}%. Considera reabastecer pronto.`,
      datos,
    };
  }

  private createCuadrePendiente(datos: CuadrePendienteData): NotificacionContent {
    const monto = datos.montoEsperado ?? 0;
    return {
      titulo: '💰 Cuadre Pendiente',
      mensaje: `Tienes un cuadre pendiente por $${monto.toLocaleString('es-CO')}. Por favor, transfiere el monto.`,
      datos,
    };
  }

  private createInversionRecuperada(datos: Record<string, unknown>): NotificacionContent {
    return {
      titulo: '🎉 ¡Inversión Recuperada!',
      mensaje: 'Has recuperado tu inversión inicial. A partir de ahora, todo es ganancia.',
      datos,
    };
  }

  private createCuadreExitoso(datos: CuadreExitosoData): NotificacionContent {
    const monto = datos.montoTransferido ?? 0;
    const esAlMayor = datos.esVentaAlMayor ?? false;

    if (esAlMayor) {
      return {
        titulo: '✅ Cuadre al Mayor Exitoso',
        mensaje: `Se ha confirmado el cuadre de tu venta al mayor.`,
        datos,
      };
    }

    return {
      titulo: '✅ Cuadre Exitoso',
      mensaje: `Se ha confirmado la transferencia de $${monto.toLocaleString('es-CO')}.`,
      datos,
    };
  }

  private createTandaLiberada(datos: TandaLiberadaData): NotificacionContent {
    const numero = datos.numeroTanda ?? 0;
    const cantidad = datos.cantidad ?? 0;
    return {
      titulo: '📦 Tanda Liberada',
      mensaje: `La tanda ${numero} ha sido liberada. ${cantidad} TRABIX están en camino.`,
      datos,
    };
  }

  private createPremioRecibido(datos: PremioRecibidoData): NotificacionContent {
    const monto = datos.monto ?? 0;
    const motivo = datos.motivo ?? datos.concepto ?? 'premio del fondo de recompensas';
    return {
      titulo: '🏆 ¡Premio Recibido!',
      mensaje: `Has recibido un premio de $${monto.toLocaleString('es-CO')} por ${motivo}.`,
      datos,
    };
  }

  // ========== Nuevos tipos ==========

  private createLoteActivado(datos: LoteActivadoData): NotificacionContent {
    const cantidad = datos.cantidadTrabix ?? 0;
    const tandas = datos.numeroTandas ?? 0;
    return {
      titulo: '🚀 ¡Lote Activado!',
      mensaje: `Tu lote de ${cantidad} TRABIX ha sido activado con ${tandas} tandas. La tanda 1 ya está liberada.`,
      datos,
    };
  }

  private createLoteFinalizado(datos: LoteFinalizadoData): NotificacionContent {
    const montoFinal = datos.montoFinal ?? 0;
    return {
      titulo: '🎊 ¡Lote Finalizado!',
      mensaje: `Tu lote ha sido completado exitosamente. Monto final: $${montoFinal.toLocaleString('es-CO')}.`,
      datos,
    };
  }

  private createEquipamientoSolicitado(datos: EquipamientoSolicitadoData): NotificacionContent {
    const esParaAdmin = datos.esParaAdmin ?? false;

    if (esParaAdmin) {
      const nombre = datos.vendedorNombre ?? 'Un vendedor';
      const deposito = datos.tieneDeposito ? 'con depósito' : 'sin depósito';
      return {
        titulo: '📋 Nueva Solicitud de Equipamiento',
        mensaje: `${nombre} ha solicitado equipamiento ${deposito}. Revisa las solicitudes pendientes.`,
        datos,
      };
    }

    return {
      titulo: '📋 Equipamiento Solicitado',
      mensaje:
        'Tu solicitud de equipamiento ha sido registrada. Espera la confirmación del administrador.',
      datos,
    };
  }

  private createEquipamientoEntregado(datos: EquipamientoEntregadoData): NotificacionContent {
    return {
      titulo: '🎒 ¡Equipamiento Entregado!',
      mensaje: 'Tu equipamiento ha sido activado y está listo para usar.',
      datos,
    };
  }

  private createFondoEgreso(datos: FondoEgresoData): NotificacionContent {
    const monto = datos.monto ?? 0;
    const beneficiario = datos.beneficiarioNombre ?? 'un vendedor';
    const concepto = datos.concepto ?? 'premio';
    return {
      titulo: '💸 Movimiento en Fondo de Recompensas',
      mensaje: `Se ha entregado $${monto.toLocaleString('es-CO')} a ${beneficiario} por concepto de: ${concepto}.`,
      datos,
    };
  }

  private createManual(datos: ManualData): NotificacionContent {
    return {
      titulo: datos.titulo ?? 'Notificación',
      mensaje: datos.mensaje ?? '',
      datos,
    };
  }

  private createGeneric(datos: ManualData): NotificacionContent {
    return {
      titulo: datos.titulo ?? 'Notificación',
      mensaje: datos.mensaje ?? 'Tienes una nueva notificación.',
      datos,
    };
  }
}
