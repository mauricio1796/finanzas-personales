import { Transaction } from '../types';

export interface RetoComunidad {
  id: string; titulo: string; descripcion: string; emoji: string;
  duracionDias: number; metaTipo: 'reducir_categoria' | 'ahorrar_monto' | 'sin_gasto';
  metaCategoria?: string; metaMonto?: number; xpRecompensa: number;
  participantesSimulados: number; dificultad: 'facil' | 'medio' | 'dificil'; isPremium: boolean;
}

export const RETOS_DISPONIBLES: RetoComunidad[] = [
  { id: 'r001', titulo: 'Semana sin domicilios', emoji: 'truck',
    descripcion: 'No pidas comida a domicilio (Rappi, iFood) por 7 dias',
    duracionDias: 7, metaTipo: 'sin_gasto', metaCategoria: 'Alimentacion',
    xpRecompensa: 75, participantesSimulados: 1847, dificultad: 'facil', isPremium: false },
  { id: 'r002', titulo: 'Mes sin ropa nueva', emoji: 'shopping-bag',
    descripcion: 'Cierra el mes sin comprar ninguna prenda de vestir ni accesorios',
    duracionDias: 30, metaTipo: 'sin_gasto', metaCategoria: 'Ropa',
    xpRecompensa: 100, participantesSimulados: 923, dificultad: 'medio', isPremium: false },
  { id: 'r003', titulo: 'Ahorrar $200.000 esta semana', emoji: 'dollar-sign',
    descripcion: 'Reduce gastos no esenciales y alcanza $200.000 de ahorro neto en 7 dias',
    duracionDias: 7, metaTipo: 'ahorrar_monto', metaMonto: 200000,
    xpRecompensa: 80, participantesSimulados: 2341, dificultad: 'medio', isPremium: false },
  { id: 'r004', titulo: 'Desafio transporte economico', emoji: 'navigation',
    descripcion: 'Gasta maximo $50.000 en transporte esta semana (usa TransMilenio o bici)',
    duracionDias: 7, metaTipo: 'reducir_categoria', metaCategoria: 'Transporte', metaMonto: 50000,
    xpRecompensa: 75, participantesSimulados: 1203, dificultad: 'facil', isPremium: false },
  { id: 'r005', titulo: 'Mes de las recetas en casa', emoji: 'coffee',
    descripcion: 'Reduce tu gasto en alimentacion un 40% cocinando en casa',
    duracionDias: 30, metaTipo: 'reducir_categoria', metaCategoria: 'Alimentacion',
    xpRecompensa: 120, participantesSimulados: 3102, dificultad: 'dificil', isPremium: false },
  { id: 'r006', titulo: 'Fondo de emergencia: primer millon', emoji: 'shield',
    descripcion: 'Acumula $1.000.000 en tu cuenta de ahorro este mes',
    duracionDias: 30, metaTipo: 'ahorrar_monto', metaMonto: 1000000,
    xpRecompensa: 150, participantesSimulados: 678, dificultad: 'dificil', isPremium: true },
];

export function calcularProgresoReto(reto: RetoComunidad, transactions: Transaction[], fechaInicio: string): number {
  const inicio = new Date(fechaInicio);
  const ahora = new Date();
  const txs = transactions.filter(t => { const d = new Date(t.date); return d >= inicio && d <= ahora; });
  if (reto.metaTipo === 'sin_gasto') {
    const gastos = txs.filter(t => t.type === 'expense' && t.category.toLowerCase() === (reto.metaCategoria ?? '').toLowerCase()).reduce((s, t) => s + t.amount, 0);
    return gastos === 0 ? 100 : Math.max(0, 100 - (gastos / 50000 * 100));
  }
  if (reto.metaTipo === 'ahorrar_monto') {
    const ingresos = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const gastos = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return Math.min(100, (Math.max(0, ingresos - gastos) / (reto.metaMonto ?? 1)) * 100);
  }
  if (reto.metaTipo === 'reducir_categoria') {
    const gastosCat = txs.filter(t => t.type === 'expense' && t.category.toLowerCase() === (reto.metaCategoria ?? '').toLowerCase()).reduce((s, t) => s + t.amount, 0);
    const limite = reto.metaMonto ?? 0;
    if (limite === 0) return 0;
    return gastosCat <= limite ? 100 : Math.max(0, 100 - ((gastosCat - limite) / limite * 100));
  }
  return 0;
}

export function getDiasRestantes(fechaInicio: string, duracionDias: number): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(inicio.getTime() + duracionDias * 24 * 60 * 60 * 1000);
  const diff = fin.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}
