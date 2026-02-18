import { IEvent } from '@nestjs/cqrs';

/**
 * Evento: Cuadre al Mayor Exitoso
 *
 * Se dispara cuando el admin confirma el cuadre al mayor.
 */
export class CuadreMayorExitosoEvent implements IEvent {
  constructor(
    public readonly cuadreMayorId: string,
    public readonly vendedorId: string,
    public readonly lotesInvolucradosIds: string[],
    public readonly cuadresCerradosIds: string[],
    public readonly loteForzadoId: string | null,
  ) {}
}
