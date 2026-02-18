import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Servicio de Redis para cache y operaciones de almacenamiento temporal
 * Según sección 18.1 del documento
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');

    if (redisUrl) {
      this.client = new Redis(redisUrl);
    } else {
      this.client = new Redis({
        host: this.configService.get<string>('redis.host', 'localhost'),
        port: this.configService.get<number>('redis.port', 6379),
        password: this.configService.get<string>('redis.password', ''),
      });
    }

    this.client.on('connect', () => {
      this.logger.log('✅ Conexión a Redis establecida');
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ Error de conexión a Redis', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('🔌 Conexión a Redis cerrada');
  }

  /**
   * Obtiene el cliente Redis para operaciones directas
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Obtiene un valor string del cache
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Obtiene un valor JSON del cache
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Almacena un valor en cache
   * @param key - Clave
   * @param value - Valor
   * @param ttlSeconds - Tiempo de vida en segundos (opcional)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Almacena un valor JSON en cache
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.set(key, jsonValue, ttlSeconds);
  }

  /**
   * Elimina una clave del cache
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Elimina múltiples claves del cache
   */
  async delMany(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * Verifica si una clave existe
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Establece un tiempo de expiración en una clave existente
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  /**
   * Obtiene el TTL restante de una clave
   * @returns TTL en segundos, -1 si no tiene expiración, -2 si no existe
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Verifica la conexión a Redis
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
