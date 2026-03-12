import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PremiumState {
  isPremium: boolean;
  plan: 'mensual' | 'anual' | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
}

export const PLANES_PREMIUM = {
  mensual: {
    precio: 12900,
    etiqueta: '$12.900/mes',
    descripcion: 'Cancela cuando quieras',
    ahorro: null as string | null,
    destacado: false,
  },
  anual: {
    precio: 89900,
    etiqueta: '$89.900/año',
    descripcion: 'Equivale a $7.491/mes',
    ahorro: 'Ahorras $64.900 vs mensual',
    destacado: true,
  },
};

export const FEATURES_GRATIS = [
  'Dashboard con donut interactivo',
  'Registro ilimitado de gastos e ingresos',
  '3 lecciones de Academia (basicas)',
  'Calendario financiero',
  'AI Insight diario',
  'Sistema de gamificacion basico',
  'Estadisticas del mes actual',
];

export const FEATURES_PREMIUM = [
  'Academia completa (8+ lecciones)',
  'Proyecciones y simulador financiero',
  'AI Insights ilimitados y personalizados',
  'Analisis de anomalias avanzado',
  'Exportar reportes en PDF',
  'Estadisticas historicas (12 meses)',
  'Retos comunidad con ranking real',
  'Soporte prioritario',
];

export async function activarPremium(plan: 'mensual' | 'anual'): Promise<PremiumState> {
  const ahora = new Date();
  const vencimiento = new Date(ahora);
  if (plan === 'mensual') {
    vencimiento.setMonth(vencimiento.getMonth() + 1);
  } else {
    vencimiento.setFullYear(vencimiento.getFullYear() + 1);
  }
  const state: PremiumState = {
    isPremium: true,
    plan,
    fechaInicio: ahora.toISOString(),
    fechaVencimiento: vencimiento.toISOString(),
  };
  await AsyncStorage.setItem('@financy_premium', JSON.stringify(state));
  return state;
}

export async function verificarPremium(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem('@financy_premium');
    if (!raw) return false;
    const state: PremiumState = JSON.parse(raw);
    if (!state.isPremium || !state.fechaVencimiento) return false;
    return new Date(state.fechaVencimiento) > new Date();
  } catch {
    return false;
  }
}
