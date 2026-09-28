/**
 * Finn en Estadísticas: pulso financiero, señales y contexto para la IA.
 *
 * Lo que estas pruebas protegen: que la lectura en vivo no invente alarmas
 * (mes a medias vs mes completo, arriendo extrapolado a diario) y que el
 * contexto que recibe Finn contenga los mismos números que dibujan las gráficas.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarEstadisticas, buildContextoEstadisticas, respuestaLocalStats,
  type EntradaStats,
} from '../src/utils/statsCoach.ts';
import type { MetricasFinancieras } from '../src/utils/ingresoUtils.ts';

let seq = 0;
const tx = (amount: number, category: string, date: string, type: 'expense' | 'income' = 'expense') =>
  ({ id: String(++seq), amount, category, type, date, description: '' }) as any;

function metricas(over: Partial<MetricasFinancieras> = {}): MetricasFinancieras {
  return {
    ingresoEfectivo: 4_000_000, esIngresoReal: false, totalGastado: 0, totalPendiente: 0,
    balanceDisponible: 4_000_000, balanceFinal: 4_000_000, porcentajeGastado: 0,
    porcentajePendiente: 0, porcentajeLibre: 100, ahorroProyectado: 4_000_000,
    enDeficit: false, montoDeficit: 0, diasRestantesMes: 0, gastoPromedioRecomendadoDia: 100_000,
    ...over,
  };
}

function entrada(over: Partial<EntradaStats>): EntradaStats {
  return {
    transactions: [], categories: [], metricas: metricas(), mes: 8, año: 2026,
    barData: [], areaData: [], hoy: new Date(2026, 8, 15), ...over,
  };
}

describe('analizarEstadisticas', () => {
  test('mes sin movimientos → sin datos, sin señales', () => {
    const a = analizarEstadisticas(entrada({}));
    assert.equal(a.pulso.estado, 'sin_datos');
    assert.equal(a.pulso.score, null);
    assert.equal(a.senales.length, 0);
  });

  test('compara con el mes anterior a la misma altura del mes, no contra el mes completo', () => {
    const a = analizarEstadisticas(entrada({
      transactions: [
        tx(100_000, 'Mercado', '2026-08-05T12:00:00'),
        tx(900_000, 'Mercado', '2026-08-25T12:00:00'), // después del día 15: no cuenta
        tx(150_000, 'Mercado', '2026-09-05T12:00:00'),
      ],
    }));
    assert.equal(a.cambioVsMesAnterior, 50);
  });

  test('los gastos fijos no se extrapolan en la proyección', () => {
    const a = analizarEstadisticas(entrada({
      categories: [{ id: 'a', name: 'Arriendo', diaPago: 1 }] as any,
      transactions: [
        tx(1_500_000, 'Arriendo', '2026-09-01T12:00:00'),
        tx(150_000, 'Mercado', '2026-09-10T12:00:00'),
      ],
    }));
    // 1.5M fijo + (150k / 15 días) × 30 días = 1.8M
    assert.equal(Math.round(a.proyeccionGasto!), 1_800_000);
    assert.ok(!a.senales.some(s => s.texto.includes('A este ritmo')));
  });

  test('al inicio del mes la proyección se apoya en el historial, no en 2 días de datos', () => {
    const a = analizarEstadisticas(entrada({
      hoy: new Date(2026, 8, 2),
      transactions: [
        // Tres meses previos con ~600k de gasto variable
        tx(600_000, 'Mercado', '2026-06-10T12:00:00'),
        tx(600_000, 'Mercado', '2026-07-10T12:00:00'),
        tx(600_000, 'Mercado', '2026-08-10T12:00:00'),
        // Un mercado grande el día 1: el ritmo puro daría 300k × 15 = 4,5M
        tx(300_000, 'Mercado', '2026-09-01T12:00:00'),
      ],
    }));
    const p = a.proyeccion!;
    assert.ok(p.pesoHistorial > 0.9);
    assert.ok(p.total < 1_000_000, `proyección ${p.total} debería estar cerca del historial`);
    assert.ok(p.total >= 600_000);
    assert.equal(p.confianza, 'media');
  });

  test('hacia fin de mes manda lo que realmente pasó', () => {
    const a = analizarEstadisticas(entrada({
      hoy: new Date(2026, 8, 27),
      transactions: [
        tx(600_000, 'Mercado', '2026-08-10T12:00:00'),
        tx(1_800_000, 'Mercado', '2026-09-20T12:00:00'),
      ],
    }));
    const p = a.proyeccion!;
    assert.ok(p.pesoHistorial < 0.15);
    assert.ok(p.total >= 1_800_000);
    assert.equal(p.confianza, 'alta');
    assert.equal(p.margen, p.ingreso - p.total);
  });

  test('sin historial ni datos suficientes no hay proyección', () => {
    const a = analizarEstadisticas(entrada({
      hoy: new Date(2026, 8, 2),
      transactions: [tx(50_000, 'Mercado', '2026-09-01T12:00:00')],
    }));
    assert.equal(a.proyeccion, null);
  });

  test('alerta cuando la proyección supera el ingreso', () => {
    const a = analizarEstadisticas(entrada({
      metricas: metricas({ ingresoEfectivo: 1_000_000 }),
      transactions: [tx(800_000, 'Mercado', '2026-09-10T12:00:00')],
    }));
    assert.equal(a.senales[0].tipo, 'alerta');
    assert.match(a.senales[0].texto, /A este ritmo/);
    assert.ok(a.pulso.score! < 55);
  });

  test('el déficit real limita el pulso a crítico', () => {
    const a = analizarEstadisticas(entrada({
      metricas: metricas({ enDeficit: true, montoDeficit: 200_000 }),
      transactions: [tx(100_000, 'Mercado', '2026-09-10T12:00:00')],
    }));
    assert.equal(a.pulso.estado, 'critico');
    assert.match(a.senales[0].texto, /superan tu ingreso/);
  });

  test('detecta presupuesto excedido', () => {
    const a = analizarEstadisticas(entrada({
      categories: [{ id: 'm', name: 'Mercado', budget: 300_000 }] as any,
      transactions: [tx(450_000, 'Mercado', '2026-09-03T12:00:00')],
    }));
    const s = a.senales.find(x => x.tipo === 'atencion');
    assert.ok(s);
    assert.match(s!.texto, /Mercado/);
    assert.match(s!.texto, /150\.000/);
  });
});

describe('buildContextoEstadisticas', () => {
  test('describe la pestaña, la gráfica en foco y las categorías con sus montos', () => {
    const e = entrada({
      categories: [{ id: 'm', name: 'Mercado', budget: 300_000 }] as any,
      transactions: [tx(450_000, 'Mercado', '2026-09-03T12:00:00')],
      barData: [{ label: 'sept', gastoActual: 450_000, gastoAnterior: 0, mes: 8, año: 2026 }],
    });
    const ctx = buildContextoEstadisticas(analizarEstadisticas(e), e, { tab: 'distribucion', chart: 'mapa' });
    assert.match(ctx, /Pestaña abierta: Mapa de gastos/);
    assert.match(ctx, /Gráfica en foco: Distribución de gastos/);
    assert.match(ctx, /Mercado: \$450\.000 \(100% del total\).*EXCEDIDO/);
    assert.match(ctx, /mes en curso, día 15 de 30/);
  });
});

describe('respuestaLocalStats', () => {
  test('resume pulso y señales sin IA', () => {
    const a = analizarEstadisticas(entrada({
      transactions: [tx(100_000, 'Mercado', '2026-09-10T12:00:00')],
    }));
    const r = respuestaLocalStats(a);
    assert.match(r, /pulso financiero está en \d+\/100/);
  });
});
