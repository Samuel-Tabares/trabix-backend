import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENT_KEY } from '../interceptors/idempotency.interceptor';

/**
 * Marca un endpoint como idempotente.
 * El interceptor IdempotencyInterceptor cacheará la respuesta en Redis
 * por 24 horas usando el header X-Idempotency-Key enviado por el cliente.
 *
 * Uso: añadir @Idempotent() sobre el método del controlador.
 * El cliente debe enviar el header X-Idempotency-Key con un UUID único por operación.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
