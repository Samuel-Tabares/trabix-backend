import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/cache/redis.service';

/**
 * Servicio para gestionar token blacklist
 * Según sección 22.1 del documento
 *
 * Los tokens se almacenan en Redis con TTL igual al tiempo restante de expiración
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly PREFIX = 'token_blacklist:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Agrega un token a la blacklist
   * @param tokenId - ID único del token (jti claim)
   * @param expirationTime - Timestamp de expiración del token
   */
  async addToBlacklist(tokenId: string, expirationTime: number): Promise<void> {
    const key = this.getKey(tokenId);
    const now = Math.floor(Date.now() / 1000);
    const ttl = expirationTime - now;

    if (ttl > 0) {
      await this.redis.set(key, '1', ttl);
      this.logger.debug(`Token ${tokenId} agregado a blacklist con TTL ${ttl}s`);
    }
  }

  /**
   * Verifica si un token está en la blacklist
   * @param tokenId - ID único del token (jti claim)
   * @returns true si está en blacklist
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    const key = this.getKey(tokenId);
    return await this.redis.exists(key);
  }
  /**
   * Genera la clave de Redis para un token
   */
  private getKey(tokenId: string): string {
    return `${this.PREFIX}${tokenId}`;
  }
}
