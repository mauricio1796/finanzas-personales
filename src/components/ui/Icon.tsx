/**
 * Icon — wrapper de Feather Icons (aesthetic/minimal line art)
 * Uso: <Icon name="home" size={22} color="#6366F1" />
 */
import React from 'react';
import { Feather } from '@expo/vector-icons';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface IconProps {
  name: FeatherName;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#6B7280' }) => (
  <Feather name={name} size={size} color={color} />
);

// ─── Mapa de categorías → Feather icon ────────────────────────────────
export const CATEGORY_ICONS: Record<string, FeatherName> = {
  // Por ID de categoría
  '1':  'shopping-cart',   // Mercado
  '2':  'navigation',      // Transporte
  '3':  'home',            // Arriendo
  '4':  'zap',             // Servicios
  '5':  'music',           // Entretenimiento
  '6':  'heart',           // Salud
  '7':  'book-open',       // Educación
  '8':  'scissors',        // Ropa
  '9':  'feather',         // Mascotas
  '10': 'shield',          // Seguros
  '11': 'headphones',      // Suscripciones
  '12': 'activity',        // Gimnasio
  '13': 'coffee',          // Restaurantes
  '14': 'film',            // Cine / Planes
  '15': 'map-pin',         // Viajes
  '16': 'gift',            // Regalos
  '17': 'user',            // Cuidado Personal
  '18': 'credit-card',     // Deudas
  '19': 'trending-up',     // Ahorros
  '20': 'more-horizontal', // Otros

  // Por nombre de categoría (para transacciones del QuickAdd)
  'mercado':          'shopping-cart',
  'transporte':       'navigation',
  'arriendo':         'home',
  'vivienda':         'home',
  'servicios':        'zap',
  'entretenimiento':  'music',
  'ocio':             'music',
  'salud':            'heart',
  'educación':        'book-open',
  'educacion':        'book-open',
  'ropa':             'scissors',
  'mascotas':         'feather',
  'seguros':          'shield',
  'suscripciones':    'headphones',
  'gimnasio':         'activity',
  'restaurantes':     'coffee',
  'cine / planes':    'film',
  'cine':             'film',
  'viajes':           'map-pin',
  'regalos':          'gift',
  'cuidado personal': 'user',
  'deudas':           'credit-card',
  'deuda/créditos':   'credit-card',
  'ahorros':          'trending-up',
  'otros':            'more-horizontal',

  // Ingresos
  'salario':          'briefcase',
  'freelance':        'monitor',
  'negocio':          'package',
  'inversiones':      'bar-chart-2',
  'alimentacion':     'shopping-cart',
  'comida':           'shopping-cart',
};

/** Devuelve el nombre de icono Feather para una categoría (por ID o nombre) */
export function getCategoryIcon(idOrName: string): FeatherName {
  const lower = idOrName.toLowerCase();
  return CATEGORY_ICONS[idOrName] ?? CATEGORY_ICONS[lower] ?? 'tag';
}

// ─── Iconos de UI general ─────────────────────────────────────────────
export const UI_ICONS = {
  // Navegación
  home:        'home'        as FeatherName,
  stats:       'bar-chart-2' as FeatherName,
  bot:         'cpu'         as FeatherName,
  finanzas:    'trending-up' as FeatherName,
  perfil:      'user'        as FeatherName,

  // Acciones
  add:         'plus'        as FeatherName,
  remove:      'minus'       as FeatherName,
  delete:      'trash-2'     as FeatherName,
  edit:        'edit-2'      as FeatherName,
  close:       'x'           as FeatherName,
  back:        'chevron-left' as FeatherName,
  forward:     'chevron-right' as FeatherName,
  menu:        'menu'        as FeatherName,
  save:        'check'       as FeatherName,
  search:      'search'      as FeatherName,
  settings:    'settings'    as FeatherName,
  alert:       'alert-triangle' as FeatherName,
  info:        'info'        as FeatherName,
  dollar:      'dollar-sign' as FeatherName,
  calendar:    'calendar'    as FeatherName,
  ai:          'zap'         as FeatherName,
};
