// Configuración centralizada de la app.
// NUNCA poner secrets aquí — solo la URL pública del Worker.

export const CONFIG = {
  // URL del Cloudflare Worker — reemplazar TU_USUARIO por tu subdominio real
  WORKER_URL: 'https://financyai-proxy.TU_USUARIO.workers.dev',

  // Versión de la app (para headers de diagnóstico)
  APP_VERSION: '1.0.0',

  // Timeouts (ms)
  AI_TIMEOUT_MS:   15_000,
  PING_TIMEOUT_MS:  5_000,

  // Límites de chat
  MAX_HISTORIAL_MENSAJES: 20,
  MAX_TOKENS_RESPUESTA:   500,
} as const;
