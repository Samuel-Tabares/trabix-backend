export * from './registrar-venta-mayor.command';
export * from './confirmar-venta-mayor.command';
export * from './eliminar-venta-mayor.command';

import { RegistrarVentaMayorHandler } from './registrar-venta-mayor.command';
import { ConfirmarVentaMayorHandler } from './confirmar-venta-mayor.command';
import { EliminarVentaMayorHandler } from './eliminar-venta-mayor.command';

export const VentaMayorCommandHandlers = [
  RegistrarVentaMayorHandler,
  ConfirmarVentaMayorHandler,
  EliminarVentaMayorHandler,
];
