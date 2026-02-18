export * from './registrar-venta-mayor.command';
export * from './completar-venta-mayor.command';

import { RegistrarVentaMayorHandler } from './registrar-venta-mayor.command';
import { CompletarVentaMayorHandler } from './completar-venta-mayor.command';

export const VentaMayorCommandHandlers = [RegistrarVentaMayorHandler, CompletarVentaMayorHandler];
