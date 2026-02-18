import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { RedisHealthIndicator } from '../../../modules/health/redis.health';
import { BullHealthIndicator } from '../../../modules/health/bull.health';
import { Public } from '../../../modules/auth/decorators/public.decorator';

/**
 * Health Check Controller
 * Según sección 20.1 del documento
 *
 * Endpoints públicos para monitoreo del sistema:
 * - GET /health          - Estado general (para load balancers)
 * - GET /health/live     - Liveness probe (para Kubernetes)
 * - GET /health/ready    - Readiness probe (para Kubernetes)
 * - GET /health/db       - Estado de base de datos
 * - GET /health/redis    - Estado de Redis
 * - GET /health/queues   - Estado de las colas Bull
 * - GET /health/detailed - Estado detallado completo
 */
@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly bullHealth: BullHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly diskHealth: DiskHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /health
   * Estado general del sistema
   * Usado por load balancers y sistemas de monitoreo
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado general del sistema' })
  @ApiResponse({ status: 200, description: 'Sistema saludable' })
  @ApiResponse({ status: 503, description: 'Sistema no saludable' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  /**
   * GET /health/live
   * Liveness probe - indica si la aplicación está corriendo
   * Usado por Kubernetes para saber si debe reiniciar el pod
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicación viva' })
  @ApiResponse({ status: 503, description: 'Aplicación no responde' })
  async liveness(): Promise<HealthCheckResult> {
    // Solo verificamos que la app responda
    return this.health.check([
      () =>
        Promise.resolve({
          app: { status: 'up', timestamp: new Date().toISOString() },
        }),
    ]);
  }
  /**
   * GET /health/ready
   * Readiness probe - indica si la aplicación puede recibir tráfico
   * Usado por Kubernetes para saber si debe enviar tráfico al pod
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicación lista para recibir tráfico' })
  @ApiResponse({ status: 503, description: 'Aplicación no lista' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Dependencia crítica → si falla, NO recibimos tráfico
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Dependencia best-effort → nunca rompe readiness
      async () => {
        try {
          return await this.redisHealth.isHealthy('redis');
        } catch {
          return {
            redis: {
              status: 'up',
              info: { degraded: true },
            },
          };
        }
      },
    ]);
  }

  /**
   * GET /health/db
   * Estado de la base de datos
   */
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de base de datos' })
  @ApiResponse({ status: 200, description: 'Base de datos saludable' })
  @ApiResponse({ status: 503, description: 'Base de datos no saludable' })
  async checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.pingCheck('database', this.prisma)]);
  }

  /**
   * GET /health/redis
   * Estado de Redis
   */
  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de Redis' })
  @ApiResponse({ status: 200, description: 'Redis saludable' })
  @ApiResponse({ status: 503, description: 'Redis no saludable' })
  async checkRedis(): Promise<HealthCheckResult> {
    return this.health.check([() => this.redisHealth.isHealthy('redis')]);
  }

  /**
   * GET /health/queues
   * Estado de las colas Bull
   */
  @Get('queues')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de las colas Bull' })
  @ApiResponse({ status: 200, description: 'Colas saludables' })
  @ApiResponse({ status: 503, description: 'Una o más colas no saludables' })
  async checkQueues(): Promise<HealthCheckResult> {
    return this.health.check([() => this.bullHealth.isHealthy('queues')]);
  }

  /**
   * GET /health/memory
   * Estado de la memoria
   */
  @Get('memory')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de la memoria' })
  @ApiResponse({ status: 200, description: 'Memoria saludable' })
  @ApiResponse({ status: 503, description: 'Memoria en estado crítico' })
  async checkMemory(): Promise<HealthCheckResult> {
    return this.health.check([
      // Heap no debe exceder 500MB
      () => this.memoryHealth.checkHeap('memory_heap', 500 * 1024 * 1024),
      // RSS no debe exceder 1GB
      () => this.memoryHealth.checkRSS('memory_rss', 1024 * 1024 * 1024),
    ]);
  }

  /**
   * GET /health/disk
   * Estado del disco
   */
  @Get('disk')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado del disco' })
  @ApiResponse({ status: 200, description: 'Disco saludable' })
  @ApiResponse({ status: 503, description: 'Disco en estado crítico' })
  async checkDisk(): Promise<HealthCheckResult> {
    return this.health.check([
      // Al menos 10% de espacio libre en el disco raíz
      () =>
        this.diskHealth.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9, // Alerta si está más del 90% lleno
        }),
    ]);
  }

  /**
   * GET /health/detailed
   * Estado detallado completo del sistema
   * Incluye todos los checks disponibles
   */
  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Estado detallado completo' })
  @ApiResponse({ status: 200, description: 'Sistema saludable' })
  @ApiResponse({ status: 503, description: 'Uno o más componentes no saludables' })
  async checkDetailed(): Promise<HealthCheckResult> {
    return this.health.check([
      // Base de datos
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Redis
      () => this.redisHealth.isHealthy('redis'),
      // Colas Bull
      () => this.bullHealth.isHealthy('queues'),
      // Memoria
      () => this.memoryHealth.checkHeap('memory_heap', 500 * 1024 * 1024),
      () => this.memoryHealth.checkRSS('memory_rss', 1024 * 1024 * 1024),
      // Disco
      () =>
        this.diskHealth.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
