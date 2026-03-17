import { Category } from '../types';
import { generarIdCategoria } from '../utils/categoryUtils';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface CatalogoItem {
  nombre: string;
  icono: string;           // Feather icon name
  tipo: 'gasto' | 'ingreso';
  pctSugerido: number;     // % del salario × 100 (ej: 2500 = 25%)
  descripcion: string;
  esencial: boolean;
  bgColorDark: string;
  bgColorLight: string;
  iconColorDark: string;
  iconColorLight: string;
}

// ── Catálogo completo ──────────────────────────────────────────────────────────

export const CATALOGO_CATEGORIAS: CatalogoItem[] = [
  // ── Esenciales ───────────────────────────────────────────────────────────────
  { nombre: 'Alimentación',    icono: 'shopping-cart',  tipo: 'gasto',   pctSugerido: 2500, descripcion: 'Mercado, restaurantes, domicilios', esencial: true,  bgColorDark: '#1E1B4B', bgColorLight: '#EEF2FF', iconColorDark: '#818CF8', iconColorLight: '#6366F1' },
  { nombre: 'Transporte',      icono: 'map-pin',        tipo: 'gasto',   pctSugerido: 1000, descripcion: 'TransMilenio, taxi, gasolina',      esencial: true,  bgColorDark: '#1C1007', bgColorLight: '#FEF3C7', iconColorDark: '#FBBF24', iconColorLight: '#F59E0B' },
  { nombre: 'Vivienda',        icono: 'home',           tipo: 'gasto',   pctSugerido: 3000, descripcion: 'Arriendo, cuota, administración',   esencial: true,  bgColorDark: '#064E3B', bgColorLight: '#D1FAE5', iconColorDark: '#34D399', iconColorLight: '#10B981' },
  { nombre: 'Salud',           icono: 'heart',          tipo: 'gasto',   pctSugerido: 500,  descripcion: 'Médico, medicamentos, EPS',         esencial: true,  bgColorDark: '#450A0A', bgColorLight: '#FEE2E2', iconColorDark: '#F87171', iconColorLight: '#EF4444' },
  { nombre: 'Educación',       icono: 'book-open',      tipo: 'gasto',   pctSugerido: 800,  descripcion: 'Cursos, universidad, materiales',   esencial: true,  bgColorDark: '#1E1B4B', bgColorLight: '#EDE9FE', iconColorDark: '#A78BFA', iconColorLight: '#8B5CF6' },
  { nombre: 'Entretenimiento', icono: 'tv',             tipo: 'gasto',   pctSugerido: 500,  descripcion: 'Netflix, cine, salidas',            esencial: true,  bgColorDark: '#2E1065', bgColorLight: '#EDE9FE', iconColorDark: '#A78BFA', iconColorLight: '#8B5CF6' },
  { nombre: 'Ropa',            icono: 'shopping-bag',   tipo: 'gasto',   pctSugerido: 500,  descripcion: 'Ropa, zapatos, accesorios',         esencial: true,  bgColorDark: '#3B1F6A', bgColorLight: '#FDF2F8', iconColorDark: '#C084FC', iconColorLight: '#A855F7' },
  { nombre: 'Servicios',       icono: 'zap',            tipo: 'gasto',   pctSugerido: 800,  descripcion: 'Agua, luz, internet, gas',          esencial: true,  bgColorDark: '#1C1007', bgColorLight: '#FEF3C7', iconColorDark: '#FBBF24', iconColorLight: '#F59E0B' },
  { nombre: 'Ahorro',          icono: 'dollar-sign',    tipo: 'ingreso', pctSugerido: 2000, descripcion: 'Meta de ahorro mensual',            esencial: true,  bgColorDark: '#0C2340', bgColorLight: '#DBEAFE', iconColorDark: '#60A5FA', iconColorLight: '#3B82F6' },
  { nombre: 'Salario',         icono: 'briefcase',      tipo: 'ingreso', pctSugerido: 0,    descripcion: 'Ingreso laboral mensual',           esencial: true,  bgColorDark: '#064E3B', bgColorLight: '#D1FAE5', iconColorDark: '#34D399', iconColorLight: '#10B981' },

  // ── Gastos adicionales ────────────────────────────────────────────────────────
  { nombre: 'Gym / Sport',     icono: 'activity',       tipo: 'gasto',   pctSugerido: 300,  descripcion: 'Gym, clases deportivas',            esencial: false, bgColorDark: '#064E3B', bgColorLight: '#D1FAE5', iconColorDark: '#34D399', iconColorLight: '#10B981' },
  { nombre: 'Mascotas',        icono: 'feather',        tipo: 'gasto',   pctSugerido: 300,  descripcion: 'Comida, veterinario, accesorios',   esencial: false, bgColorDark: '#1A2E1A', bgColorLight: '#DCFCE7', iconColorDark: '#4ADE80', iconColorLight: '#22C55E' },
  { nombre: 'Restaurantes',    icono: 'coffee',         tipo: 'gasto',   pctSugerido: 800,  descripcion: 'Comer fuera de casa',               esencial: false, bgColorDark: '#1C1007', bgColorLight: '#FEF3C7', iconColorDark: '#FBBF24', iconColorLight: '#F59E0B' },
  { nombre: 'Delivery',        icono: 'truck',          tipo: 'gasto',   pctSugerido: 400,  descripcion: 'Rappi, iFood, domicilios',          esencial: false, bgColorDark: '#1C1007', bgColorLight: '#FEF3C7', iconColorDark: '#FBBF24', iconColorLight: '#F59E0B' },
  { nombre: 'Suscripciones',   icono: 'repeat',         tipo: 'gasto',   pctSugerido: 300,  descripcion: 'Spotify, YouTube, apps',            esencial: false, bgColorDark: '#2E1065', bgColorLight: '#EDE9FE', iconColorDark: '#A78BFA', iconColorLight: '#8B5CF6' },
  { nombre: 'Viajes',          icono: 'globe',          tipo: 'gasto',   pctSugerido: 500,  descripcion: 'Vuelos, hoteles, vacaciones',       esencial: false, bgColorDark: '#0C2340', bgColorLight: '#DBEAFE', iconColorDark: '#60A5FA', iconColorLight: '#3B82F6' },
  { nombre: 'Regalos',         icono: 'gift',           tipo: 'gasto',   pctSugerido: 200,  descripcion: 'Cumpleaños, fechas especiales',     esencial: false, bgColorDark: '#3B1F6A', bgColorLight: '#FDF2F8', iconColorDark: '#C084FC', iconColorLight: '#A855F7' },
  { nombre: 'Hogar',           icono: 'tool',           tipo: 'gasto',   pctSugerido: 400,  descripcion: 'Muebles, reparaciones, decoración', esencial: false, bgColorDark: '#064E3B', bgColorLight: '#D1FAE5', iconColorDark: '#34D399', iconColorLight: '#10B981' },
  { nombre: 'Deudas',          icono: 'credit-card',    tipo: 'gasto',   pctSugerido: 1500, descripcion: 'Tarjetas, créditos, préstamos',     esencial: false, bgColorDark: '#450A0A', bgColorLight: '#FEE2E2', iconColorDark: '#F87171', iconColorLight: '#EF4444' },
  { nombre: 'Belleza',         icono: 'scissors',       tipo: 'gasto',   pctSugerido: 200,  descripcion: 'Peluquería, spa, estética',         esencial: false, bgColorDark: '#3B1F6A', bgColorLight: '#FDF2F8', iconColorDark: '#C084FC', iconColorLight: '#A855F7' },
  { nombre: 'Tecnología',      icono: 'monitor',        tipo: 'gasto',   pctSugerido: 300,  descripcion: 'Gadgets, accesorios tech',          esencial: false, bgColorDark: '#1E1B4B', bgColorLight: '#EEF2FF', iconColorDark: '#818CF8', iconColorLight: '#6366F1' },
  { nombre: 'Seguros',         icono: 'shield',         tipo: 'gasto',   pctSugerido: 300,  descripcion: 'Seguro de vida, vehículo, hogar',   esencial: false, bgColorDark: '#0C2340', bgColorLight: '#DBEAFE', iconColorDark: '#60A5FA', iconColorLight: '#3B82F6' },
  { nombre: 'Niños',           icono: 'users',          tipo: 'gasto',   pctSugerido: 800,  descripcion: 'Colegio, útiles, ropa, actividades', esencial: false, bgColorDark: '#1C1007', bgColorLight: '#FEF3C7', iconColorDark: '#FBBF24', iconColorLight: '#F59E0B' },
  { nombre: 'Otros',           icono: 'more-horizontal', tipo: 'gasto',  pctSugerido: 300,  descripcion: 'Gastos varios no categorizados',    esencial: false, bgColorDark: '#252528', bgColorLight: '#F3F4F6', iconColorDark: '#71717A', iconColorLight: '#6B7280' },

  // ── Ingresos adicionales ──────────────────────────────────────────────────────
  { nombre: 'Freelance',       icono: 'code',           tipo: 'ingreso', pctSugerido: 0,    descripcion: 'Ingresos por proyectos',            esencial: false, bgColorDark: '#1E1B4B', bgColorLight: '#EEF2FF', iconColorDark: '#818CF8', iconColorLight: '#6366F1' },
  { nombre: 'Inversiones',     icono: 'trending-up',    tipo: 'ingreso', pctSugerido: 0,    descripcion: 'Rendimientos, dividendos',          esencial: false, bgColorDark: '#064E3B', bgColorLight: '#D1FAE5', iconColorDark: '#34D399', iconColorLight: '#10B981' },
];

// ── Conversión a Category ──────────────────────────────────────────────────────

export function catalogoItemToCategory(
  item: CatalogoItem,
  presupuesto?: number,
): Category {
  return {
    id: generarIdCategoria(),
    name: item.nombre,
    icon: item.icono,
    tipo: item.tipo,
    isSelected: true,
    budget: presupuesto ?? 0,
    pagado: false,
    fechaCreacion: new Date().toISOString(),
  };
}

// ── Paleta de color por nombre (para getBgIconoCategoria extendido) ────────────

export function getPaletaItem(
  nombre: string,
  isDark: boolean,
): { bg: string; color: string } {
  const item = CATALOGO_CATEGORIAS.find(c => c.nombre === nombre);
  if (!item) return { bg: isDark ? '#252528' : '#F3F4F6', color: isDark ? '#71717A' : '#6B7280' };
  return {
    bg:    isDark ? item.bgColorDark    : item.bgColorLight,
    color: isDark ? item.iconColorDark  : item.iconColorLight,
  };
}
