import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

/**
 * Guard de rate limiting personalizado para el endpoint de login
 * Lee la configuración desde las variables de entorno via ConfigService
 *
 * Usa THROTTLE_LOGIN_TTL y THROTTLE_LOGIN_LIMIT del .env
 *
 * NOTA: @Inject(ConfigService) es necesario porque ThrottlerGuard
 * tiene su propia firma de constructor y NestJS resuelve los
 * parámetros por los metadatos del padre, no del hijo.
 */
@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  constructor(
    storageService: ThrottlerStorage,
    @Inject(ConfigService) configService: ConfigService,
    reflector: Reflector,
  ) {
    const ttl = configService.get<number>('throttle.login.ttl', 60000);
    const limit = configService.get<number>('throttle.login.limit', 5);

    super(
      {
        throttlers: [
          {
            name: 'login',
            ttl,
            limit,
          },
        ],
        errorMessage: 'Demasiados intentos de login. Intente más tarde.',
      },
      storageService,
      reflector,
    );
  }

  /**
   * Genera la clave de tracking usando la IP del cliente
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `login_throttle:${ip}`;
  }

  /**
   * Maneja el caso cuando se excede el límite de requests
   */
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiados intentos de login. Intente más tarde.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}