import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  /**
   * Global
   * Ej: 100 requests / minuto / IP
   */
  global: {
    ttl: Number(process.env.THROTTLE_GLOBAL_TTL) * 1000,
    limit: Number(process.env.THROTTLE_GLOBAL_LIMIT),
  },

  /**
   * Login
   * Ej: 5 requests / minuto / IP
   */
  login: {
    ttl: Number(process.env.THROTTLE_LOGIN_TTL) * 1000,
    limit: Number(process.env.THROTTLE_LOGIN_LIMIT),
  },

  /**
   * Endpoints sensibles
   * Ej: 20 requests / minuto / IP
   */
  sensitive: {
    ttl: Number(process.env.THROTTLE_SENSITIVE_TTL) * 1000,
    limit: Number(process.env.THROTTLE_SENSITIVE_LIMIT),
  },

  /**
   * WebSocket
   * Ej: 10 conexiones / minuto / usuario
   */
  websocket: {
    ttl: Number(process.env.THROTTLE_WEBSOCKET_TTL) * 1000,
    limit: Number(process.env.THROTTLE_WEBSOCKET_LIMIT),
  },
}));
