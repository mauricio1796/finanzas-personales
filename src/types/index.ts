// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  monthlySalary?: number;
  createdAt?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  budget?: number;       // canonical monthly budget amount (replaces presupuesto)
  isSelected?: boolean;
  diaPago?: number;
  pagado?: boolean;
  tipo?: 'gasto' | 'ingreso' | 'fijo' | 'variable';
  fechaCreacion?: string;
  parentCategoryId?: string; // ID of parent category (if this is a subcategory)
}

export type CategoryUpdate = Partial<Omit<Category, 'id'>>;

// Transaction Types
export interface Transaction {
  id: string;
  amount: number;
  /**
   * Nombre visible de la categoría. Se mantiene sincronizado con el nombre
   * actual de la categoría (ver categoryResolver) para que la agregación por
   * nombre siga siendo válida.
   */
  category: string;
  /**
   * Identificador estable de la categoría (BUG-10). Sobrevive a los cambios de
   * nombre, por lo que el histórico nunca se pierde al renombrar. Opcional
   * porque las transacciones creadas antes de esta versión se migran al
   * hidratar el estado.
   */
  categoryId?: string;
  date: string;
  type: 'income' | 'expense';
  description?: string;
  subcategory?: string; // subcategory ID (optional)
  /** Medio de pago con el que se hizo (MedioPago.id). */
  paymentMethodId?: string;
  /** De dónde salió el registro. Sin valor = manual (transacciones antiguas). */
  source?: OrigenTransaccion;
  /** Comercio detectado (captura automática o recibo). */
  merchant?: string;
  /** Huella de la compra para no registrarla dos veces si llega por varios canales. */
  dedupeHash?: string;
}

export type OrigenTransaccion =
  | 'manual'
  | 'recibo'
  | 'notificacion'
  | 'correo'
  | 'atajo'
  | 'texto'
  | 'open_finance';

// ─── Medios de pago (Billetera) ──────────────────────────────────────────────
// Nunca se guarda el número completo de la tarjeta, el CVV ni claves: solo
// alias, franquicia y los últimos 4 dígitos (fuera del alcance de PCI DSS).
export type TipoMedioPago = 'credito' | 'debito' | 'billetera' | 'cuenta' | 'efectivo';
export type Franquicia = 'visa' | 'mastercard' | 'amex' | 'diners' | 'otra';

export interface MedioPago {
  id: string;
  tipo: TipoMedioPago;
  /** Id del catálogo de entidades (utils/mediosPago). */
  entidad: string;
  alias: string;
  ultimos4?: string;
  franquicia?: Franquicia;
  color: string;
  /** Solo crédito. */
  cupo?: number;
  diaCorte?: number;
  diaPago?: number;
  predeterminado: boolean;
  /** Archivado: ya no se ofrece al registrar, pero el historial lo conserva. */
  archivado: boolean;
  creadoEn: string;
}

// Auth Types
export type AuthState = 'login' | 'register' | 'authenticated';

// Screen Names
export type ScreenName =
  | 'dashboard'
  | 'ingresos'
  | 'gastos'
  | 'categorias'
  | 'estadisticas'
  | 'botia'
  | 'usuario'
  | 'metas'
  | 'deudas'
  | 'recurrentes';

// ─── Meta (savings goal) ─────────────────────────────────────────────────────
export interface AporteMeta {
  monto: number;
  fecha: string; // ISO
}

export interface Meta {
  id: string;
  nombre: string;
  montoObjetivo: number;
  montoActual: number;
  emoji: string;
  color: string;
  fechaLimite?: string;
  completada: boolean;
  creadaEn: string;
  /** Historial de abonos — opcional para no romper metas ya guardadas sin este campo. */
  aportes?: AporteMeta[];
}

// ─── Deuda ────────────────────────────────────────────────────────────────────
export interface PagoDeuda {
  id: string;
  monto: number;
  fecha: string;
  nota?: string;
}

export interface Deuda {
  id: string;
  nombre: string;
  montoOriginal: number;
  saldo: number;
  tasaMensual: number; // porcentaje, ej: 2.5 para 2.5%
  cuotaMensual: number;
  diaPago?: number;
  pagos: PagoDeuda[];
  creadaEn: string;
  saldada: boolean;
}

// ─── Gasto Recurrente ─────────────────────────────────────────────────────────
export interface GastoRecurrente {
  id: string;
  nombre: string;
  monto: number;
  categoria: string;
  frecuencia: 'diario' | 'semanal' | 'quincenal' | 'mensual' | 'anual';
  diaPago?: number; // día del mes para frecuencia mensual
  activo: boolean;
  proximoPago?: string;
  creadoEn: string;
  descripcion?: string;
}

// ========== NUEVOS TIPOS PARA ONBOARDING Y FEATURES AVANZADAS ==========

// Perfil Financiero
export interface FinancialProfile {
  id: string;
  userId: string;
  employmentType: 'employed' | 'student' | 'freelance' | 'business' | 'other';
  incomeType: 'fixed' | 'variable' | 'mixed';
  monthlySalary: number;
  hasDebts: boolean;
  debtAmount?: number;
  mainFinancialConcern: string;
  currencyPreference: string;
  /** Cuánto ahorraba al mes antes de Finn (solo si lo declaró; null = lo borró). */
  puntoPartida?: PuntoPartida | null;
  createdAt: string;
  updatedAt: string;
}

/** Compra que el usuario decidió NO hacer tras usar el Simulador. */
export interface CompraEvitada {
  id: string;
  monto: number;
  fecha: string; // ISO
  descripcion?: string;
}

/** Línea base de ahorro contra la que se mide el cambio con la app. */
export interface PuntoPartida {
  /** COP ahorrados al mes antes de Finn (puede ser 0). */
  ahorroMensual: number;
  /** declarado: lo dijo el usuario · calculado: su primer mes completo registrado. */
  fuente: 'declarado' | 'calculado';
  /** Desde cuándo se mide el cambio (ISO). */
  fecha: string;
}

// Objetivo Financiero
export interface FinancialGoal {
  id: string;
  userId: string;
  type: 'savings' | 'debt_elimination' | 'expense_control' | 'investment' | 'organization';
  title: string;
  description?: string;
  targetAmount?: number;
  currentAmount: number;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Presupuesto
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: number;
  spent: number;
  month: string; // YYYY-MM
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

// Logro/Medal
export interface Achievement {
  id: string;
  userId: string;
  type: 'streak' | 'budget_control' | 'savings_goal' | 'no_debt' | 'first_transaction' | 'custom';
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  unlocked: boolean;
}

// Nivel del Usuario
export interface UserLevel {
  id: string;
  userId: string;
  level: number; // 1-10 (ver NIVELES en GamificacionService)
  experience: number;
  title: string; // título del nivel actual, derivado del XP
  createdAt: string;
  updatedAt: string;
}

// Análisis y Recomendaciones IA
export interface AIAnalysis {
  id: string;
  userId: string;
  type: 'spending_pattern' | 'savings_projection' | 'risk_alert' | 'optimization' | 'insight';
  title: string;
  message: string;
  recommendation?: string;
  urgency: 'low' | 'medium' | 'high';
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// Reto Financiero
export interface Challenge {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  targetCategory?: string;
  targetAmount?: number;
  duration: number; // en días
  startDate: string;
  endDate: string;
  completed: boolean;
  progress: number;
  reward?: string;
  createdAt: string;
}

// Estado de Onboarding
export interface OnboardingState {
  completed: boolean;
  step: number; // 0-4 (Welcome, Profile, Goal, Budget, Confirmation)
  profileCompleted: boolean;
  goalSelected: boolean;
  budgetCreated: boolean;
  createdAt: string;
  updatedAt: string;
}
