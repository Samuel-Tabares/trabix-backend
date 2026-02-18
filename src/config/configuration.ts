// src/config/configuration.ts
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import throttleConfig from './throttle.config';

const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    apiPrefix: process.env.API_PREFIX,
  },

  database: databaseConfig(),
  redis: redisConfig(),
  jwt: jwtConfig(),
  throttle: throttleConfig(),

  queue: {
    redisUrl: process.env.BULL_REDIS_URL ?? process.env.REDIS_URL,
  },

  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS),
    rateLimitTtl: Number(process.env.RATE_LIMIT_TTL),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX),
    corsOrigin: process.env.CORS_ORIGIN,
  },

  // Configuración de bloqueo progresivo por intentos fallidos
  lockout: {
    level1: {
      attempts: Number(process.env.LOCKOUT_LEVEL1_ATTEMPTS),
      durationMinutes: Number(process.env.LOCKOUT_LEVEL1_MINUTES),
    },
    level2: {
      attempts: Number(process.env.LOCKOUT_LEVEL2_ATTEMPTS),
      durationMinutes: Number(process.env.LOCKOUT_LEVEL2_MINUTES),
    },
    level3: {
      attempts: Number(process.env.LOCKOUT_LEVEL3_ATTEMPTS),
      durationMinutes: Number(process.env.LOCKOUT_LEVEL3_MINUTES),
    },
    permanentLockoutAttempts: Number(process.env.LOCKOUT_PERMANENT_ATTEMPTS),
  },

  business: {
    costoPercibidoTrabix: Number(process.env.COSTO_PERCIBIDO_TRABIX),
    aporteFondoPorTrabix: Number(process.env.APORTE_FONDO_POR_TRABIX),
    precioUnidadLicor: Number(process.env.PRECIO_UNIDAD_LICOR),
    precioPromoLicor: Number(process.env.PRECIO_PROMO_LICOR),
    precioUnidadSinLicor: Number(process.env.PRECIO_UNIDAD_SIN_LICOR),
    precioMayor20Licor: Number(process.env.PRECIO_MAYOR_20_LICOR),
    precioMayor50Licor: Number(process.env.PRECIO_MAYOR_50_LICOR),
    precioMayor100Licor: Number(process.env.PRECIO_MAYOR_100_LICOR),
    precioMayor20SinLicor: Number(process.env.PRECIO_MAYOR_20_SIN_LICOR),
    precioMayor50SinLicor: Number(process.env.PRECIO_MAYOR_50_SIN_LICOR),
    precioMayor100SinLicor: Number(process.env.PRECIO_MAYOR_100_SIN_LICOR),
  },

  equipamiento: {
    mensualidadConDeposito: Number(process.env.MENSUALIDAD_CON_DEPOSITO),
    mensualidadSinDeposito: Number(process.env.MENSUALIDAD_SIN_DEPOSITO),
    deposito: Number(process.env.DEPOSITO_EQUIPAMIENTO),
    costoDanoNevera: Number(process.env.COSTO_DANO_NEVERA),
    costoDanoPijama: Number(process.env.COSTO_DANO_PIJAMA),
  },

  porcentajes: {
    vendedor6040: Number(process.env.PORCENTAJE_GANANCIA_VENDEDOR_60_40),
    admin6040: Number(process.env.PORCENTAJE_GANANCIA_ADMIN_60_40),
    vendedor5050: Number(process.env.PORCENTAJE_GANANCIA_VENDEDOR_50_50),
    inversion: Number(process.env.PORCENTAJE_INVERSION_VENDEDOR),
    limiteRegalos: Number(process.env.LIMITE_REGALOS),
    triggerCuadreT2: Number(process.env.TRIGGER_CUADRE_T2),
    triggerCuadreT3: Number(process.env.TRIGGER_CUADRE_T3),
    triggerCuadreT1_2Tandas: Number(process.env.TRIGGER_CUADRE_T1_2TANDAS),
    triggerCuadreT2_2Tandas: Number(process.env.TRIGGER_CUADRE_T2_2TANDAS),
  },

  lotes: {
    maxLotesCreadosPorVendedor: Number(process.env.MAX_LOTES_CREADOS_POR_VENDEDOR),
    inversionMinimaVendedor: Number(process.env.INVERSION_MINIMA_VENDEDOR),
    umbralTandasTres: Number(process.env.UMBRAL_TANDAS_TRES),
  },

  tiempos: {
    autoTransitoHoras: Number(process.env.TIEMPO_AUTO_TRANSITO_HORAS),
  },

  logging: {
    level: process.env.LOG_LEVEL,
    format: process.env.LOG_FORMAT,
  },

  healthCheck: {
    enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
  },

  outbox: {
    pollInterval: Number(process.env.OUTBOX_POLL_INTERVAL),
    maxRetries: Number(process.env.OUTBOX_MAX_RETRIES),
  },
});
export default configuration;
