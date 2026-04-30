import { storageService } from './storage/StorageService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncOperation {
  id: string;
  fn: () => Promise<void>;
  intentos: number;
  maxIntentos: number;
  descripcion: string;
}

type SyncStatusListener = (status: SyncStatus, pendingCount: number) => void;

// ─── SyncQueueService ─────────────────────────────────────────────────────────
// Cola de sync con reintentos, backoff exponencial y notificación de estado.
// Reemplaza los .catch(() => {}) del FinanceContext por un mecanismo robusto.

class SyncQueueService {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private status: SyncStatus = 'idle';
  private listeners: SyncStatusListener[] = [];
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ─── API pública ───────────────────────────────────────────────────────────

  enqueue(descripcion: string, fn: () => Promise<void>, maxIntentos = 3): void {
    const op: SyncOperation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fn,
      intentos: 0,
      maxIntentos,
      descripcion,
    };
    this.queue.push(op);
    this.setStatus('syncing', this.queue.length);
    this.processNext();
  }

  onStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.push(listener);
    // Retorna función de cleanup
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getStatus(): SyncStatus { return this.status; }
  getPendingCount(): number { return this.queue.length; }

  // Fuerza reprocesar la cola (útil al recuperar conexión)
  flush(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.processNext();
  }

  // ─── Procesamiento interno ─────────────────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      if (this.queue.length === 0) this.setStatus('idle', 0);
      return;
    }

    this.isProcessing = true;
    const op = this.queue[0];

    try {
      op.intentos++;
      await op.fn();
      // Éxito: eliminar de la cola
      this.queue.shift();
      this.isProcessing = false;

      if (this.queue.length > 0) {
        this.setStatus('syncing', this.queue.length);
        await this.processNext();
      } else {
        this.setStatus('idle', 0);
      }
    } catch (e: any) {
      this.isProcessing = false;
      const isNetworkError = this.isNetworkError(e);

      if (isNetworkError) {
        // Sin red: marcar offline y esperar sin consumir reintentos
        this.setStatus('offline', this.queue.length);
        this.scheduleRetry(10_000); // reintentar en 10s
        return;
      }

      if (op.intentos >= op.maxIntentos) {
        // Agotó reintentos: descartar y continuar con la siguiente
        console.warn(`[SyncQueue] Operación descartada (${op.intentos} intentos): ${op.descripcion}`, e?.message);
        this.queue.shift();
        this.setStatus(this.queue.length > 0 ? 'syncing' : 'error', this.queue.length);
        // Continuar con la siguiente operación
        await this.processNext();
        return;
      }

      // Error transitorio: backoff exponencial (1s, 2s, 4s)
      const delay = Math.min(1000 * Math.pow(2, op.intentos - 1), 8000);
      this.setStatus('error', this.queue.length);
      this.scheduleRetry(delay);
    }
  }

  private scheduleRetry(delayMs: number): void {
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      if (this.queue.length > 0) {
        this.setStatus('syncing', this.queue.length);
        this.processNext();
      }
    }, delayMs);
  }

  private setStatus(status: SyncStatus, pendingCount: number): void {
    this.status = status;
    this.listeners.forEach(l => l(status, pendingCount));
  }

  private isNetworkError(e: any): boolean {
    const msg = String(e?.message ?? '').toLowerCase();
    return (
      e?.name === 'NetworkError' ||
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('internet') ||
      msg.includes('offline') ||
      msg.includes('net::err')
    );
  }
}

export const syncQueue = new SyncQueueService();
