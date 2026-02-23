// src/config/configuration.ts
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import throttleConfig from './throttle.config';

// Convierte directivas CSP del .env (string separado por comas)
// en un array válido para Helmet.
// dotenv elimina las comillas, pero Helmet exige valores como 'self'
// explícitamente entre comillas simples.
// Esta función divide, limpia y agrega las comillas si faltan.
const parseCsp = (value?: string) =>
  value
    ? value.split(',').map(v => {
      const trimmed = v.trim();
      // Si ya tiene comillas, lo dejamos igual
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed;
      }
      // Palabras clave que requieren comillas en CSP
      const keywordsRequiringQuotes = [
        'self',
        'unsafe-inline',
        'unsafe-eval',
        'none',
        'strict-dynamic',
        'report-sample',
      ];
      if (keywordsRequiringQuotes.includes(trimmed)) {
        return `'${trimmed}'`;
      }
      // data:, https:, http:, etc NO llevan comillas
      return trimmed;
    })
    : undefined;

const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV,
    port: Number(process.env.PORT) || 3000,
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
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitTtl: Number(process.env.RATE_LIMIT_TTL) || 60,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
    corsOrigin: process.env.CORS_ORIGIN,

    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: parseCsp(process.env.CSP_DEFAULT_SRC),
          styleSrc: parseCsp(process.env.CSP_STYLE_SRC),
          imgSrc: parseCsp(process.env.CSP_IMG_SRC),
          scriptSrc: parseCsp(process.env.CSP_SCRIPT_SRC),
        },
      },
      crossOriginEmbedderPolicy: false,
    },

    cors: {
      methods: process.env.CORS_METHODS ?? 'GET,HEAD,PUT,PATCH,POST,DELETE',
      headers: process.env.CORS_HEADERS ?? 'Content-Type,Authorization',
      credentials: true,
    },
  },

  // Configuración de bloqueo progresivo por intentos fallidos
  lockout: {
    level1: {
      attempts: Number(process.env.LOCKOUT_LEVEL1_ATTEMPTS) || 5,
      durationMinutes: Number(process.env.LOCKOUT_LEVEL1_MINUTES) || 15,
    },
    level2: {
      attempts: Number(process.env.LOCKOUT_LEVEL2_ATTEMPTS) || 10,
      durationMinutes: Number(process.env.LOCKOUT_LEVEL2_MINUTES) || 60,
    },
    level3: {
      attempts: Number(process.env.LOCKOUT_LEVEL3_ATTEMPTS) || 15,
      durationMinutes: Number(process.env.LOCKOUT_LEVEL3_MINUTES) || 1440,
    },
    permanentLockoutAttempts: Number(process.env.LOCKOUT_PERMANENT_ATTEMPTS) || 20,
  },

  business: {
    costoPercibidoTrabix: Number(process.env.COSTO_PERCIBIDO_TRABIX) || 2400,
    aporteFondoPorTrabix: Number(process.env.APORTE_FONDO_POR_TRABIX) || 200,
    precioUnidadLicor: Number(process.env.PRECIO_UNIDAD_LICOR) || 8000,
    precioPromoLicor: Number(process.env.PRECIO_PROMO_LICOR) || 12000,
    precioUnidadSinLicor: Number(process.env.PRECIO_UNIDAD_SIN_LICOR) || 7000,
    precioMayor20Licor: Number(process.env.PRECIO_MAYOR_20_LICOR) || 4900,
    precioMayor50Licor: Number(process.env.PRECIO_MAYOR_50_LICOR) || 4700,
    precioMayor100Licor: Number(process.env.PRECIO_MAYOR_100_LICOR) || 4500,
    precioMayor20SinLicor: Number(process.env.PRECIO_MAYOR_20_SIN_LICOR) || 4800,
    precioMayor50SinLicor: Number(process.env.PRECIO_MAYOR_50_SIN_LICOR) || 4500,
    precioMayor100SinLicor: Number(process.env.PRECIO_MAYOR_100_SIN_LICOR) || 4200,
  },

  equipamiento: {
    mensualidadConDeposito: Number(process.env.MENSUALIDAD_CON_DEPOSITO) || 9990,
    mensualidadSinDeposito: Number(process.env.MENSUALIDAD_SIN_DEPOSITO) || 19990,
    deposito: Number(process.env.DEPOSITO_EQUIPAMIENTO) || 49990,
    costoDanoNevera: Number(process.env.COSTO_DANO_NEVERA) || 30000,
    costoDanoPijama: Number(process.env.COSTO_DANO_PIJAMA) || 60000,
  },

  porcentajes: {
    vendedor6040: Number(process.env.PORCENTAJE_GANANCIA_VENDEDOR_60_40) || 60,
    admin6040: Number(process.env.PORCENTAJE_GANANCIA_ADMIN_60_40) || 40,
    vendedor5050: Number(process.env.PORCENTAJE_GANANCIA_VENDEDOR_50_50) || 50,
    inversion: Number(process.env.PORCENTAJE_INVERSION_VENDEDOR) || 50,
    limiteRegalos: Number(process.env.LIMITE_REGALOS) || 8,
    triggerCuadreT2: Number(process.env.TRIGGER_CUADRE_T2) || 10,
    triggerCuadreT3: Number(process.env.TRIGGER_CUADRE_T3) || 20,
    triggerCuadreT1_2Tandas: Number(process.env.TRIGGER_CUADRE_T1_2TANDAS) || 10,
    triggerCuadreT2_2Tandas: Number(process.env.TRIGGER_CUADRE_T2_2TANDAS) || 20,
  },

  lotes: {
    maxLotesCreadosPorVendedor: Number(process.env.MAX_LOTES_CREADOS_POR_VENDEDOR) || 3,
    inversionMinimaVendedor: Number(process.env.INVERSION_MINIMA_VENDEDOR) || 0,
    umbralTandasTres: Number(process.env.UMBRAL_TANDAS_TRES) || 50,
  },

  tiempos: {
    autoTransitoHoras: Number(process.env.TIEMPO_AUTO_TRANSITO_HORAS) || 2,
  },

  logging: {
    level: process.env.LOG_LEVEL,
    format: process.env.LOG_FORMAT,
  },

  healthCheck: {
    enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
  },

  outbox: {
    pollInterval: Number(process.env.OUTBOX_POLL_INTERVAL) || 5000,
    maxRetries: Number(process.env.OUTBOX_MAX_RETRIES) || 3,
  },
});
export default configuration;
