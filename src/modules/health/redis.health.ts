import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../../infrastructure/cache/redis.service';

/**
 * Indicador de salud para Redis
 * Usado por @nestjs/terminus para health checks
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.redis.ping();

      if (isHealthy) {
        return this.getStatus(key, true, {
          message: 'Redis is reachable',
        });
      }

      throw new HealthCheckError(
        'Redis ping failed',
        this.getStatus(key, false, {
          message: 'Redis is not reachable',
        }),
      );
    } catch (error) {
      throw new HealthCheckError(
        'Redis connection failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
