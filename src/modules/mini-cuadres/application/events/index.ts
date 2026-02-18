export * from './mini-cuadre-exitoso.event';
export * from './mini-cuadre-exitoso.handler';
export * from './stock-ultima-tanda-agotado.event';

import { MiniCuadreExitosoHandler } from './mini-cuadre-exitoso.handler';
import { StockUltimaTandaAgotadoHandler } from './stock-ultima-tanda-agotado.event';

export const MiniCuadreEventHandlers = [MiniCuadreExitosoHandler, StockUltimaTandaAgotadoHandler];
