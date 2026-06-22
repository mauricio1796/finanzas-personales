import type { Transaction, Category, FinancialProfile, FinancialGoal } from '../../types';

// ── Tipos de alerta ───────────────────────────────────────────────────────────

export type TipoAlerta =
  | 'presupuesto_80pct'
  | 'presupuesto_100pct'
  | 'gasto_aumento_categoria'
  | 'gasto_anomalo'           // Premium
  | 'compromiso_saldo_ajustado'
  | 'ritmo_insostenible'
  | 'racha_ahorro'            // máx 1/semana
  | 'meta_cerca'
  | 'insight_diario';         // Premium

export interface AlertaCandidato {
  tipo:          TipoAlerta;
  referencia_id: string;
  mensaje:       string;
  esPremium:     boolean;
}

export interface FinnAlerta {
  id:            string;
  usuario_id:    string;
  tipo_alerta:   TipoAlerta;
  referencia_id: string;
  mensaje:       string;
  enviado_at:    string;
  leido:         boolean;
  canal:         'push' | 'inapp' | 'dashboard';
}

export interface AlertPreferences {
  alertas_activas:       boolean;
  max_alertas_dia:       number;
  insight_diario_activo: boolean;
  hora_insight:          string;
  alertas_presupuesto:   boolean;
  alertas_anomalias:     boolean;
  alertas_compromisos:   boolean;
  alertas_ritmo:         boolean;
  alertas_ahorro:        boolean;
  alertas_metas:         boolean;
}

export const DEFAULT_PREFS: AlertPreferences = {
  alertas_activas:       true,
  max_alertas_dia:       4,
  insight_diario_activo: true,
  hora_insight:          '08:00',
  alertas_presupuesto:   true,
  alertas_anomalias:     true,
  alertas_compromisos:   true,
  alertas_ritmo:         true,
  alertas_ahorro:        true,
  alertas_metas:         true,
};

// ── Parámetros del detector ───────────────────────────────────────────────────

export interface DetectorParams {
  transactions: Transaction[];
  categories:   Category[];
  profile:      FinancialProfile | null;
  goal:         FinancialGoal | null;
  isPremium:    boolean;
  prefs:        AlertPreferences;
}
