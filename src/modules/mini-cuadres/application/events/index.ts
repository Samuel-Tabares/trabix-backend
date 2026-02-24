export * from './mini-cuadre-exitoso.event';
export * from './mini-cuadre-exitoso.handler';
export * from './stock-ultima-tanda-agotado.event';
export * from './cuadre-exitoso-para-mini-cuadre.handler';

import { MiniCuadreExitosoHandler } from './mini-cuadre-exitoso.handler';
import { StockUltimaTandaAgotadoHandler } from './stock-ultima-tanda-agotado.event';
import { CuadreExitosoParaMiniCuadreHandler } from './cuadre-exitoso-para-mini-cuadre.handler';

export const MiniCuadreEventHandlers = [
  MiniCuadreExitosoHandler,
  StockUltimaTandaAgotadoHandler,
  CuadreExitosoParaMiniCuadreHandler,
];
