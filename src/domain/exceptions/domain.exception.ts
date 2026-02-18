/**
 * Excepción base de dominio
 * Todas las excepciones de negocio heredan de esta clase
 */
export class DomainException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.details = details;

    // Mantiene el stack trace correcto
    Error.captureStackTrace(this, this.constructor);
  }
}
