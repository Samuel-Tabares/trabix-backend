import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../../../domain/exceptions/domain.exception';
import { ErrorResponse } from './http-exception.filter';

/**
 * Filtro para excepciones de dominio
 * Según sección 22.7 del documento
 *
 * Transforma excepciones de dominio en respuestas HTTP apropiadas
 * usando el formato estándar del documento
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  // Mapeo de códigos de dominio a códigos HTTP según sección 22.7
  private readonly statusCodeMap: Record<string, number> = {
    // Autenticación (AUTH)
    AUTH_001: HttpStatus.UNAUTHORIZED, // Credenciales inválidas
    AUTH_002: HttpStatus.UNAUTHORIZED, // Token expirado
    AUTH_003: HttpStatus.UNAUTHORIZED, // Token inválido
    AUTH_004: HttpStatus.UNAUTHORIZED, // Refresh token inválido
    AUTH_005: HttpStatus.FORBIDDEN, // Usuario bloqueado temporalmente
    AUTH_006: HttpStatus.FORBIDDEN, // Requiere cambio de contraseña

    // Usuarios (USR)
    USR_001: HttpStatus.NOT_FOUND, // Usuario no encontrado
    USR_002: HttpStatus.CONFLICT, // Cédula ya registrada
    USR_003: HttpStatus.CONFLICT, // Email ya registrado
    USR_004: HttpStatus.CONFLICT, // Teléfono ya registrado
    USR_005: HttpStatus.BAD_REQUEST, // Reclutador no válido
    USR_006: HttpStatus.FORBIDDEN, // Usuario inactivo

    // Lotes (LOTE)
    LOTE_001: HttpStatus.CONFLICT, // Stock de admin insuficiente
    LOTE_002: HttpStatus.FORBIDDEN, // Vendedor no puede crear lotes
    LOTE_003: HttpStatus.NOT_FOUND, // Lote no encontrado
    LOTE_004: HttpStatus.CONFLICT, // Lote ya está activo
    LOTE_005: HttpStatus.CONFLICT, // Lote no puede finalizarse

    // Tandas (TND)
    TND_001: HttpStatus.NOT_FOUND, // Tanda no encontrada
    TND_002: HttpStatus.CONFLICT, // Transición de estado inválida
    TND_003: HttpStatus.CONFLICT, // Ya existe tanda liberada en el lote
    TND_004: HttpStatus.CONFLICT, // Cuadre anterior no está exitoso

    // Ventas (VNT)
    VNT_001: HttpStatus.CONFLICT, // Stock insuficiente
    VNT_002: HttpStatus.CONFLICT, // No hay tanda EN_CASA disponible
    VNT_003: HttpStatus.CONFLICT, // Límite de regalos excedido
    VNT_004: HttpStatus.NOT_FOUND, // Venta no encontrada
    VNT_005: HttpStatus.CONFLICT, // Venta ya procesada

    // Ventas al Mayor (VTM)
    VTM_001: HttpStatus.BAD_REQUEST, // Cantidad mínima no alcanzada (>20)
    VTM_002: HttpStatus.CONFLICT, // Stock total insuficiente
    VTM_003: HttpStatus.NOT_FOUND, // Venta al mayor no encontrada

    // Cuadres (CUA)
    CUA_001: HttpStatus.NOT_FOUND, // Cuadre no encontrado
    CUA_002: HttpStatus.CONFLICT, // Estado inválido
    CUA_003: HttpStatus.BAD_REQUEST, // Monto inválido
    CUA_004: HttpStatus.CONFLICT, // Conflicto de versión

    // Equipamiento (EQP)
    EQP_001: HttpStatus.CONFLICT, // Ya tiene equipamiento
    EQP_002: HttpStatus.CONFLICT, // Estado inválido
    EQP_003: HttpStatus.CONFLICT, // Deuda pendiente
    EQP_004: HttpStatus.NOT_FOUND, // No encontrado

    // Fondo (FND)
    FND_001: HttpStatus.CONFLICT, // Saldo insuficiente

    // Pedidos (PED)
    PED_001: HttpStatus.BAD_REQUEST, // Cantidad inválida
    PED_002: HttpStatus.CONFLICT, // Estado inválido
    PED_003: HttpStatus.BAD_REQUEST, // Falta costo obligatorio
    PED_004: HttpStatus.NOT_FOUND, // No encontrado
    PED_005: HttpStatus.CONFLICT, // Ya confirmado

    // Configuración (CFG)
    CFG_001: HttpStatus.NOT_FOUND, // Clave no encontrada
    CFG_002: HttpStatus.BAD_REQUEST, // Valor inválido
    CFG_003: HttpStatus.FORBIDDEN, // No modificable
    CFG_004: HttpStatus.CONFLICT, // Conflicto

    // Insumos (INS)
    INS_001: HttpStatus.CONFLICT, // Nombre duplicado
    INS_002: HttpStatus.FORBIDDEN, // No se puede eliminar obligatorio
    INS_003: HttpStatus.NOT_FOUND, // No encontrado

    // Genéricos
    ENTITY_NOT_FOUND: HttpStatus.NOT_FOUND,
    CONFLICT: HttpStatus.CONFLICT,
    VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  };

  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.statusCodeMap[exception.code] || HttpStatus.BAD_REQUEST;

    // Formato según sección 22.7
    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode: exception.code,
      message: exception.message,
      ...(exception.details && { details: exception.details }),
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Domain Exception: ${exception.code} - ${exception.message}`);

    response.status(status).json(errorResponse);
  }
}
