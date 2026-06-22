// ─── Escaneo de recibos — Tipos TypeScript ───────────────────────────────────

/** Resultado que devuelve el Worker tras analizar la imagen */
export interface ReceiptScanResult {
  monto:              number | null;
  fecha:              string | null;    // YYYY-MM-DD
  comercio:           string | null;
  categoria_sugerida: string | null;   // nombre exacto de categoría del usuario
  confianza:          number;          // 0.0 – 1.0
  es_recibo:          boolean;
  nota:               string | null;
}

/** Datos confirmados por el usuario antes de registrar el gasto */
export interface ReceiptConfirmData {
  monto:      number;
  fecha:      Date;
  comercio:   string;
  categoria:  string;    // nombre de la categoría
  subcategoria?: string; // ID de subcategoría (opcional)
  descripcion?: string;
}

/** Estados de la pantalla de escaneo */
export type ScanEstado =
  | 'idle'          // esperando que el usuario abra cámara o galería
  | 'capturando'    // image picker abierto
  | 'procesando'    // llamada al Worker en curso
  | 'confirmacion'  // mostrando ResultadoConfirmacion
  | 'guardando'     // addExpense en curso
  | 'exito'         // gasto registrado correctamente
  | 'error';        // error manejado
