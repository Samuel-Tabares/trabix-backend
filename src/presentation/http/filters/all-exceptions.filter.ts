import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from './http-exception.filter';

/**
 * Filtro global para todas las excepciones no manejadas
 * Según sección 22.7 del documento
 *
 * Captura cualquier error que no haya sido manejado por otros filtros
 * y retorna una respuesta genérica de error interno
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Log del error completo
    this.logger.error(
      `Unhandled exception: ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // Formato según sección 22.7
    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Ha ocurrido un error interno. Por favor intente más tarde.',
      timestamp: new Date().toISOString(),
    };

    // En desarrollo, incluir más detalles
    if (process.env.NODE_ENV === 'development') {
      (errorResponse as ErrorResponse & { details: unknown }).details = {
        name: exception instanceof Error ? exception.name : 'Unknown',
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      };
    }

    response.status(status).json(errorResponse);
  }
}
