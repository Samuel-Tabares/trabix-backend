export * from './obtener-venta.query';
export * from './listar-ventas.query';

import { ObtenerVentaHandler } from './obtener-venta.query';
import { ListarVentasHandler } from './listar-ventas.query';

/**
 * Array de todos los query handlers del módulo ventas
 */
export const VentaQueryHandlers = [ObtenerVentaHandler, ListarVentasHandler];
