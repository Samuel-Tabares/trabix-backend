export * from './obtener-cuadre.query';
export * from './listar-cuadres.query';

import { ObtenerCuadreHandler } from './obtener-cuadre.query';
import { ListarCuadresHandler } from './listar-cuadres.query';

/**
 * Array de todos los query handlers del módulo cuadres
 */
export const CuadreQueryHandlers = [ObtenerCuadreHandler, ListarCuadresHandler];
