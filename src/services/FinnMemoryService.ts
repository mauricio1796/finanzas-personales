import { supabaseService, type FinnMemory } from './supabase/SupabaseService';
import { storageService } from './storage/StorageService';
import type { Transaction, Category } from '../types';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';

// ─── Tipos de la memoria de Finn ──────────────────────────────────────────────

export interface PatronesUsuario {
  diaMayorGasto: string | null;           // "lunes", "viernes", etc.
  categoriaTop: string | null;            // categoría donde más gasta
  tendenciaAhorro: 'mejorando' | 'empeorando' | 'estable';
  promedioGastoDiario: number;
  mesesConDatos: number;
  ultimoMesConSuperavit: string | null;   // "2025-03"
  alertasRecurrentes: string[];           // patrones negativos repetidos
}

export interface PreferenciasUsuario {
  prefiereMensajesCortos: boolean;
  tonoPreferido: 'formal' | 'casual';
  temasDeInteres: string[];               // ['ahorro', 'deudas', 'inversión']
  monedaDisplay: string;                  // 'COP', 'USD', etc.
}

export interface ResumenMesAnterior {
  mes: string;                            // "2025-03"
  ingresoTotal: number;
  gastoTotal: number;
  ahorro: number;
  porcentajeAhorro: number;
  categoriaTopGasto: string;
  metaAlcanzada: boolean;
  rachaMaxima: number;
}

// ─── FinnMemoryService ────────────────────────────────────────────────────────

class FinnMemoryService {
  private memoryCache: FinnMemory | null = null;
  private lastFetch = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  async getMemory(userId: string): Promise<FinnMemory | null> {
    const now = Date.now();
    if (this.memoryCache && now - this.lastFetch < this.CACHE_TTL) {
      return this.memoryCache;
    }
    const memory = await supabaseService.getFinnMemory(userId);
    this.memoryCache = memory;
    this.lastFetch = now;
    return memory;
  }

  // Llama al cierre de cada mes para guardar el resumen
  async actualizarResumenMes(
    userId: string,
    transactions: Transaction[],
    categories: Category[],
    monthlySalary: number,
    mes: number,
    año: number,
  ): Promise<void> {
    const metricas = calcularMetricasFinancieras(transactions, categories, monthlySalary, mes, año);
    const gastosPorCat: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mes && d.getFullYear() === año;
      })
      .forEach(t => { gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount; });

    const categoriaTop = Object.entries(gastosPorCat)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const resumen: ResumenMesAnterior = {
      mes: `${año}-${String(mes + 1).padStart(2, '0')}`,
      ingresoTotal: metricas.ingresoEfectivo,
      gastoTotal: metricas.totalGastado,
      ahorro: metricas.ahorroProyectado,
      porcentajeAhorro: metricas.porcentajeLibre,
      categoriaTopGasto: categoriaTop ?? 'desconocida',
      metaAlcanzada: metricas.ahorroProyectado > 0,
      rachaMaxima: this.calcularRachaMaxima(transactions),
    };

    await supabaseService.upsertFinnMemory(userId, { resumen_mes_anterior: resumen });
    this.memoryCache = null; // invalidar cache
  }

  // Analiza patrones de comportamiento financiero del usuario
  async analizarPatrones(
    userId: string,
    transactions: Transaction[],
    categories: Category[],
    monthlySalary: number,
  ): Promise<void> {
    if (transactions.length < 5) return; // no hay suficientes datos

    const gastosPorDia: Record<string, number> = {};
    const gastosPorCat: Record<string, number> = {};
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const d = new Date(t.date);
        const dia = diasSemana[d.getDay()];
        gastosPorDia[dia] = (gastosPorDia[dia] || 0) + t.amount;
        gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + t.amount;
      });

    const diaMayorGasto = Object.entries(gastosPorDia)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const categoriaTop = Object.entries(gastosPorCat)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Tendencia: compara gasto este mes vs mes anterior
    const hoy = new Date();
    const mesActual = calcularMetricasFinancieras(transactions, categories, monthlySalary, hoy.getMonth(), hoy.getFullYear());
    const mesAnterior = calcularMetricasFinancieras(transactions, categories, monthlySalary, hoy.getMonth() - 1, hoy.getFullYear());

    let tendencia: PatronesUsuario['tendenciaAhorro'] = 'estable';
    if (mesActual.porcentajeLibre > mesAnterior.porcentajeLibre + 5) tendencia = 'mejorando';
    else if (mesActual.porcentajeLibre < mesAnterior.porcentajeLibre - 5) tendencia = 'empeorando';

    // Alertas recurrentes
    const alertas: string[] = [];
    if (mesActual.porcentajeGastado >= 90) alertas.push('presupuesto_al_limite');
    if (mesActual.totalPendiente > mesActual.balanceDisponible) alertas.push('pendientes_superan_disponible');

    const patrones: PatronesUsuario = {
      diaMayorGasto,
      categoriaTop,
      tendenciaAhorro: tendencia,
      promedioGastoDiario: mesActual.gastoPromedioRecomendadoDia,
      mesesConDatos: this.contarMesesConDatos(transactions),
      ultimoMesConSuperavit: mesActual.ahorroProyectado > 0
        ? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
        : null,
      alertasRecurrentes: alertas,
    };

    await supabaseService.upsertFinnMemory(userId, { patrones });
    this.memoryCache = null;
  }

  buildContextoMemoria(memory: FinnMemory | null): string {
    if (!memory) return '';

    const partes: string[] = [];
    const patrones = memory.patrones as PatronesUsuario | undefined;
    const resumen = memory.resumen_mes_anterior as ResumenMesAnterior | undefined;

    if (patrones) {
      const f = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      partes.push('PATRONES DEL USUARIO:');
      if (patrones.categoriaTop) partes.push(`- Mayor gasto histórico: ${patrones.categoriaTop}`);
      if (patrones.diaMayorGasto) partes.push(`- Día que más gasta: ${patrones.diaMayorGasto}`);
      partes.push(`- Tendencia de ahorro: ${patrones.tendenciaAhorro}`);
      if (patrones.promedioGastoDiario > 0) partes.push(`- Gasto promedio recomendado por día: ${f(patrones.promedioGastoDiario)}`);
      if (patrones.alertasRecurrentes.length > 0) {
        partes.push(`- Alertas recurrentes: ${patrones.alertasRecurrentes.join(', ')}`);
      }
    }

    if (resumen) {
      const f = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
      partes.push('\nMES ANTERIOR:');
      partes.push(`- Ingreso: ${f(resumen.ingresoTotal)} | Gasto: ${f(resumen.gastoTotal)} | Ahorro: ${f(resumen.ahorro)} (${resumen.porcentajeAhorro}%)`);
      partes.push(`- Mayor gasto en: ${resumen.categoriaTopGasto}`);
      if (!resumen.metaAlcanzada) partes.push('- No alcanzó la meta de ahorro el mes pasado');
    }

    return partes.length > 0 ? partes.join('\n') : '';
  }

  private calcularRachaMaxima(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;
    const dias = new Set(transactions.map(t => t.date.substring(0, 10)));
    const sorted = Array.from(dias).sort();
    let max = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      current = diff === 1 ? current + 1 : 1;
      if (current > max) max = current;
    }
    return max;
  }

  private contarMesesConDatos(transactions: Transaction[]): number {
    const meses = new Set(transactions.map(t => t.date.substring(0, 7)));
    return meses.size;
  }
}

export const finnMemoryService = new FinnMemoryService();
