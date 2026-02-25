export * from './venta-aprobada.event';
export * from './venta-aprobada.handler';

import { VentaRegistradaHandler } from './venta-aprobada.handler';

/**
 * Array de todos los event handlers del módulo ventas
 */
export const VentaEventHandlers = [VentaRegistradaHandler];
