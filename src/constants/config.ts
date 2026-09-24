// Configuración centralizada de la app.
// NUNCA poner secrets aquí — solo la URL pública del Worker.

const WORKER_URL_ENV = process.env.EXPO_PUBLIC_WORKER_URL ?? '';
const WORKER_TOKEN_ENV = process.env.EXPO_PUBLIC_WORKER_TOKEN ?? '';

if (!WORKER_URL_ENV) {
  console.warn(
    '[FinancyAI] ⚠️  EXPO_PUBLIC_WORKER_URL no configurada en .env.local. Finn usará modo local.'
  );
}

export const CONFIG = {
  WORKER_URL: WORKER_URL_ENV,

  // Token de app que el Worker puede verificar (no es un secret de API, es un identificador de origen)
  // Agrega en .env.local: EXPO_PUBLIC_WORKER_TOKEN=financyai-mobile-v1
  // Y en el Worker: verifica que el header X-App-Token coincida con tu valor esperado
  WORKER_TOKEN: WORKER_TOKEN_ENV || 'financyai-mobile-v1',

  APP_VERSION: '1.1.0',

  // Cobro de Premium con pasarela externa (Wompi) dentro de la app.
  // App Store (Guideline 3.1.1) y Google Play (política de Pagos) exigen su
  // sistema de compras integrado para desbloquear funciones digitales. Mientras
  // no exista integración IAP, los builds de tienda deben usar
  // EXPO_PUBLIC_EXTERNAL_PAYMENTS=false (ver eas.json › production).
  EXTERNAL_PAYMENTS_ENABLED: (process.env.EXPO_PUBLIC_EXTERNAL_PAYMENTS ?? 'true') !== 'false',

  // Timeouts (ms)
  AI_TIMEOUT_MS:   15_000,
  PING_TIMEOUT_MS:  5_000,

  // Límites de chat
  MAX_HISTORIAL_MENSAJES: 20,
  MAX_TOKENS_RESPUESTA:   700,

  // Rate limiting cliente (ms entre llamadas consecutivas)
  MIN_MS_ENTRE_MENSAJES: 1_000,
} as const;

/** Cabeceras estándar para toda petición al Worker (identifican la app). */
export const WORKER_HEADERS: Record<string, string> = {
  'Content-Type':  'application/json',
  'X-App-Version': CONFIG.APP_VERSION,
  'X-App-Token':   CONFIG.WORKER_TOKEN,
};
