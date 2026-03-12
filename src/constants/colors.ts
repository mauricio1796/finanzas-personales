/**
 * Color constants — Minimalist Finance Theme (White + Indigo)
 * DARK_COLORS = Light minimalist palette (indigo accent, white surface)
 * LIGHT_COLORS = Same palette (single theme)
 */

export const DARK_COLORS = {
  // ── Primary (Indigo accent) ───────────────────────────────────────
  primary:        '#6366F1',   // indigo-500
  primary_light:  '#EEF2FF',   // indigo-50 (tinted bg for badges)
  primary_dark:   '#4338CA',   // indigo-700

  // ── Secondary / AI ────────────────────────────────────────────────
  secondary:       '#8B5CF6',  // violet-500 (AI purple)
  secondary_light: '#F5F3FF',  // violet-50
  secondary_dark:  '#6D28D9',  // violet-700

  // ── Finance accents ───────────────────────────────────────────────
  accent_gold:   '#F59E0B',    // amber (savings / warning)
  accent_danger: '#EF4444',    // red-500 (expense)
  accent_purple: '#8B5CF6',    // violet (AI / goals)

  // ── Status ────────────────────────────────────────────────────────
  success: '#10B981',           // emerald-500 (income)
  warning: '#F59E0B',           // amber
  error:   '#EF4444',           // red-500
  info:    '#6366F1',           // indigo

  // ── Backgrounds ───────────────────────────────────────────────────
  background:           '#FAFAFA',  // near-white page
  background_secondary: '#F3F4F6',  // gray-100 subtle section bg
  background_surface:   '#FFFFFF',  // pure white card

  // ── Surfaces / Cards ──────────────────────────────────────────────
  glass_bg:          '#FFFFFF',               // white card
  glass_bg_medium:   'rgba(255,255,255,0.80)', // semi-transparent overlay
  glass_bg_strong:   '#F9FAFB',               // gray-50 alt surface
  glass_border:      '#E5E7EB',               // gray-200 border
  glass_border_strong: '#D1D5DB',             // gray-300 stronger border

  // ── Text ──────────────────────────────────────────────────────────
  text_primary:   '#111827',   // gray-900
  text_secondary: '#6B7280',   // gray-500
  text_tertiary:  '#9CA3AF',   // gray-400
  text_light:     '#FFFFFF',   // white (for colored button text)

  // ── Neutrals ──────────────────────────────────────────────────────
  white:        '#FFFFFF',
  black:        '#111827',
  gray:         '#E5E7EB',
  gray_light:   '#F3F4F6',
  gray_lighter: '#FAFAFA',
};

export const LIGHT_COLORS = DARK_COLORS;

// Backward compatibility
export const COLORS = DARK_COLORS;
