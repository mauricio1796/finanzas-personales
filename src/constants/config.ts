// Configuración centralizada de la app.
// NUNCA poner secrets aquí — solo la URL pública del Worker.

// La URL del Worker se lee primero de la variable de entorno EXPO_PUBLIC_WORKER_URL,
// con fallback al placeholder para detectarlo en runtime.
const WORKER_URL_ENV = process.env.EXPO_PUBLIC_WORKER_URL ?? '';

if (!WORKER_URL_ENV || WORKER_URL_ENV.includes('TU_USUARIO')) {
  console.warn(
    '[FinancyAI] ⚠️  WORKER_URL no configurada. ' +
    'Define EXPO_PUBLIC_WORKER_URL en .env.local con la URL real de tu Cloudflare Worker. ' +
    'Finn usará modo local hasta que se configure.'
  );
}

export const CONFIG = {
  // URL del Cloudflare Worker
  // 1. Crea el archivo .env.local en finanzas-personales/
  // 2. Agrega: EXPO_PUBLIC_WORKER_URL=https://financyai-proxy.TU_SUBDOMINIO.workers.dev
  WORKER_URL: WORKER_URL_ENV || 'https://financyai-proxy.TU_USUARIO.workers.dev',

  // Versión de la app (para headers de diagnóstico)
  APP_VERSION: '1.1.0',

  // Timeouts (ms)
  AI_TIMEOUT_MS:   15_000,
  PING_TIMEOUT_MS:  5_000,

  // Límites de chat
  MAX_HISTORIAL_MENSAJES: 20,
  MAX_TOKENS_RESPUESTA:   700, // aumentado para respuestas más completas con contexto enriquecido

  // Rate limiting cliente (ms entre llamadas consecutivas)
  MIN_MS_ENTRE_MENSAJES: 1_000,
} as const;
