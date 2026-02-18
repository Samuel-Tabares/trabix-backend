import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../../infrastructure/cache/redis.service';

/**
 * Clave para marcar endpoints que requieren idempotencia
 */
export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Interface para respuesta cacheada
 */
interface CachedResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Interceptor de idempotencia
 * Según sección 18.4.2 del documento
 *
 * Previene procesamiento duplicado de operaciones críticas
 * usando el header X-Idempotency-Key
 *
 * TTL de 24 horas para las claves
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly PREFIX = 'idempotency:';
  private readonly TTL_SECONDS = 86400; // 24 horas

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    // Verificar si el endpoint requiere idempotencia
    const requiresIdempotency = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresIdempotency) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const idempotencyKey = request.headers['x-idempotency-key'];

    // Si no hay clave de idempotencia, procesar normalmente
    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = this.getCacheKey(idempotencyKey, request.url);

    // Verificar si ya existe una respuesta cacheada
    const cachedResponse = await this.redis.getJson<CachedResponse>(cacheKey);

    if (cachedResponse) {
      // Retornar respuesta cacheada
      response.status(cachedResponse.statusCode);
      return of(cachedResponse.body);
    }

    // Verificar si hay una operación en progreso
    const lockKey = `${cacheKey}:lock`;
    const lockAcquired = await this.acquireLock(lockKey);

    if (!lockAcquired) {
      throw new ConflictException(
        'Una operación con la misma clave de idempotencia está en progreso',
      );
    }

    // Procesar la solicitud y cachear la respuesta
    return next.handle().pipe(
      mergeMap((data) =>
        from(
          (async () => {
            const responseToCache: CachedResponse = {
              statusCode: response.statusCode,
              body: data,
            };

            await this.redis.setJson(cacheKey, responseToCache, this.TTL_SECONDS);
            await this.releaseLock(lockKey);

            return data;
          })(),
        ),
      ),
      catchError((err) =>
        from(this.releaseLock(lockKey)).pipe(mergeMap(() => throwError(() => err))),
      ),
    );
  }

  private getCacheKey(idempotencyKey: string, endpoint: string): string {
    return `${this.PREFIX}${endpoint}:${idempotencyKey}`;
  }

  private async acquireLock(lockKey: string): Promise<boolean> {
    const result = await this.redis.getClient().set(lockKey, '1', 'EX', 30, 'NX');
    return result === 'OK';
  }

  private async releaseLock(lockKey: string): Promise<void> {
    await this.redis.del(lockKey);
  }
}
