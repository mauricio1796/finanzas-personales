/**
 * Screen names and navigation constants
 */

export const SCREEN_NAMES = {
  DASHBOARD: 'dashboard',
  INGRESOS: 'ingresos',
  GASTOS: 'gastos',
  CATEGORIAS: 'categorias',
  ESTADISTICAS: 'estadisticas',
  BOTIA: 'botia',
  USUARIO: 'usuario',
} as const;

export type ScreenName = typeof SCREEN_NAMES[keyof typeof SCREEN_NAMES];
