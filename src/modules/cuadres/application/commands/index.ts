// Re-exportar commands
export { ActivarCuadreCommand, ActivarCuadreHandler } from './activar-cuadre.command';
export { ConfirmarCuadreCommand, ConfirmarCuadreHandler } from './confirmar-cuadre.command';

// Array de handlers para registrar en el módulo
import { ActivarCuadreHandler } from './activar-cuadre.command';
import { ConfirmarCuadreHandler } from './confirmar-cuadre.command';

export const CuadreCommandHandlers = [ActivarCuadreHandler, ConfirmarCuadreHandler];
