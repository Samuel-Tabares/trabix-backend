export * from './registrar-venta.command';

import { RegistrarVentaHandler } from './registrar-venta.command';

/**
 * Array de todos los command handlers del módulo ventas
 */
export const VentaCommandHandlers = [RegistrarVentaHandler];
