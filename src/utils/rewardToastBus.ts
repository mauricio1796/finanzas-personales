// Bus mínimo para disparar el toast de recompensa desde cualquier punto del
// estado (FinanceContext) sin acoplar ese estado a un componente de UI.
export interface RewardToastPayload {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

type Listener = (payload: RewardToastPayload) => void;

const listeners = new Set<Listener>();

export function emitRewardToast(payload: Omit<RewardToastPayload, 'id'>): void {
  const full: RewardToastPayload = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...payload };
  listeners.forEach(l => l(full));
}

export function subscribeRewardToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
