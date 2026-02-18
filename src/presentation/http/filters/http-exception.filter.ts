import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Interface de respuesta de error estándar
 * Según sección 22.7 del documento
 */
export interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Filtro global de excepciones HTTP
 * Según sección 22.7 del documento
 *
 * Formato:
 * {
 *   "statusCode": 400,
 *   "errorCode": "LOTE_001",
 *   "message": "Stock insuficiente para crear el lote",
 *   "details": { "stockDisponible": 50, "stockSolicitado": 100 },
 *   "timestamp": "2025-01-05T10:30:00Z"
 * }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extraer mensaje y detalles de la excepción
    let message: string;
    let details: unknown;
    let errorCode: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errorCode = this.getCodeFromStatus(status);
    } else if (typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp.message as string) || exception.message;
      details = resp.errors || resp.details;
      errorCode =
        (resp.errorCode as string) || (resp.code as string) || this.getCodeFromStatus(status);

      // Si message es un array (validation errors), unirlo
      if (Array.isArray(message)) {
        details = { errors: message };
        message = 'Error de validación';
        errorCode = 'VALIDATION_ERROR';
      }
    } else {
      message = exception.message;
      errorCode = this.getCodeFromStatus(status);
    }

    // Formato según sección 22.7
    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    };

    // Log del error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
    }

    response.status(status).json(errorResponse);
  }

  private getCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'AUTH_001',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };

    return statusCodes[status] || 'UNKNOWN_ERROR';
  }
}
