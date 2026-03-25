import { type Transaction, type Category } from '../types';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ConfigReporte {
  mes: number;              // 0–11
  año: number;
  incluirGraficos: boolean;
  incluirCategorias: boolean;
  incluirTransacciones: boolean;
  incluirProyeccion: boolean;
  filtroTipo: 'todos' | 'ingresos' | 'gastos';
}

export interface DatosReporte {
  nombreUsuario: string;
  transactions: Transaction[];
  categories: Category[];
  salary: number;
  goal?: { amount?: number; targetAmount?: number; title?: string };
  config: ConfigReporte;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

function filtrarMes(txs: Transaction[], mes: number, año: number): Transaction[] {
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === mes && d.getFullYear() === año;
  });
}

function totalTipo(txs: Transaction[], tipo: 'income' | 'expense'): number {
  return txs.filter(t => t.type === tipo).reduce((s, t) => s + t.amount, 0);
}

function porcentaje(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function colorBarra(pct: number): string {
  if (pct >= 90) return '#EF4444';
  if (pct >= 70) return '#F59E0B';
  return '#10B981';
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const PDF_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #F9FAFB;
    color: #111827;
    font-size: 13px;
    line-height: 1.5;
  }
  .page { max-width: 800px; margin: 0 auto; padding: 0 0 40px; }

  /* Header */
  .report-header {
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    color: white;
    padding: 36px 40px 28px;
    position: relative;
    overflow: hidden;
  }
  .report-header::after {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 180px; height: 180px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .brand span { opacity: 0.7; font-weight: 400; }
  .header-meta { text-align: right; font-size: 11px; opacity: 0.75; line-height: 1.6; }
  .report-title { font-size: 30px; font-weight: 800; margin-top: 18px; letter-spacing: -0.8px; }
  .report-subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }

  /* Metric cards */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 24px 40px 0;
  }
  .metric-card {
    background: white;
    border-radius: 14px;
    padding: 18px 20px;
    border: 1px solid #E5E7EB;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #9CA3AF; margin-bottom: 6px; }
  .metric-value { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .metric-income { color: #10B981; }
  .metric-expense { color: #EF4444; }
  .metric-savings { color: #6366F1; }
  .metric-sub { font-size: 11px; color: #9CA3AF; margin-top: 4px; }

  /* Section */
  .section {
    background: white;
    border-radius: 16px;
    margin: 20px 40px 0;
    border: 1px solid #E5E7EB;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    overflow: hidden;
    page-break-before: auto;
  }
  .section-header {
    padding: 16px 20px 14px;
    border-bottom: 1px solid #F3F4F6;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon {
    width: 32px; height: 32px; border-radius: 9px;
    background: #EEF2FF;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
  .section-title { font-size: 15px; font-weight: 700; color: #111827; }
  .section-body { padding: 16px 20px; }

  /* Bar chart rows */
  .bar-row { margin-bottom: 12px; }
  .bar-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .bar-name { font-size: 12px; font-weight: 600; color: #374151; }
  .bar-amount { font-size: 12px; font-weight: 700; color: #111827; }
  .bar-track { height: 8px; background: #F3F4F6; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 8px; border-radius: 4px; }

  /* Transaction table */
  .tx-table { width: 100%; border-collapse: collapse; }
  .tx-table th {
    text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #9CA3AF; padding: 0 8px 10px;
  }
  .tx-table td { padding: 9px 8px; border-top: 1px solid #F3F4F6; font-size: 12px; }
  .tx-table tr:last-child td { border-bottom: none; }
  .tx-cat { color: #374151; font-weight: 500; text-transform: capitalize; }
  .tx-desc { color: #9CA3AF; font-size: 11px; }
  .tx-date { color: #9CA3AF; white-space: nowrap; }
  .tx-income { color: #10B981; font-weight: 700; }
  .tx-expense { color: #EF4444; font-weight: 700; }
  .tx-badge {
    display: inline-block; padding: 2px 8px; border-radius: 100px;
    font-size: 10px; font-weight: 600;
  }
  .badge-income { background: #D1FAE5; color: #065F46; }
  .badge-expense { background: #FEE2E2; color: #991B1B; }

  /* Categories table */
  .cat-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 0; border-top: 1px solid #F3F4F6;
  }
  .cat-row:first-child { border-top: none; }
  .cat-rank { font-size: 11px; font-weight: 700; color: #9CA3AF; width: 18px; }
  .cat-info { flex: 1; }
  .cat-name { font-size: 13px; font-weight: 600; color: #111827; text-transform: capitalize; }
  .cat-bar-wrap { flex: 2; }
  .cat-amount { font-size: 13px; font-weight: 700; color: #EF4444; min-width: 80px; text-align: right; }
  .cat-pct { font-size: 11px; color: #9CA3AF; min-width: 36px; text-align: right; }

  /* Projection */
  .proj-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .proj-card {
    background: #F9FAFB; border-radius: 12px; padding: 14px 16px;
    border: 1px solid #F3F4F6;
  }
  .proj-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #9CA3AF; margin-bottom: 6px; }
  .proj-value { font-size: 19px; font-weight: 800; }
  .proj-positive { color: #10B981; }
  .proj-negative { color: #EF4444; }
  .proj-neutral { color: #6366F1; }
  .proj-note { font-size: 11px; color: #9CA3AF; margin-top: 3px; }

  /* Goal progress */
  .goal-section { margin-top: 14px; }
  .goal-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .goal-label { font-size: 12px; font-weight: 600; color: #374151; }
  .goal-pct { font-size: 12px; font-weight: 700; color: #6366F1; }
  .goal-track { height: 10px; background: #EEF2FF; border-radius: 5px; overflow: hidden; }
  .goal-fill { height: 10px; background: #6366F1; border-radius: 5px; }

  /* Footer */
  .footer {
    margin: 28px 40px 0;
    padding-top: 14px;
    border-top: 1px solid #E5E7EB;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-brand { font-size: 12px; font-weight: 700; color: #6366F1; }
  .footer-note { font-size: 11px; color: #9CA3AF; }

  @media print {
    .section { page-break-inside: avoid; }
    .section-page-break { page-break-before: always; }
  }
`;

// ── Section builders ──────────────────────────────────────────────────────────

function seccionResumen(txsMes: Transaction[], salary: number): string {
  const ingresos  = totalTipo(txsMes, 'income');
  const gastos    = totalTipo(txsMes, 'expense');
  const ahorro    = ingresos - gastos;
  const tasaAhorro = porcentaje(ahorro, ingresos);

  return `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Ingresos del mes</div>
        <div class="metric-value metric-income">${fmt(ingresos)}</div>
        <div class="metric-sub">${salary > 0 ? `Salario: ${fmt(salary)}` : 'Sin salario registrado'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Gastos del mes</div>
        <div class="metric-value metric-expense">${fmt(gastos)}</div>
        <div class="metric-sub">${txsMes.filter(t => t.type === 'expense').length} transacciones</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Ahorro neto</div>
        <div class="metric-value metric-savings">${fmt(ahorro)}</div>
        <div class="metric-sub">Tasa de ahorro: ${tasaAhorro}%</div>
      </div>
    </div>
  `;
}

function seccionGraficoCategorias(txsMes: Transaction[]): string {
  const gastos = txsMes.filter(t => t.type === 'expense');
  const totalG = gastos.reduce((s, t) => s + t.amount, 0);

  // Aggregate by category
  const catMap: Record<string, number> = {};
  for (const t of gastos) {
    catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
  }
  const cats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (cats.length === 0) {
    return `<div class="section">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <span class="section-title">Distribución de Gastos</span>
      </div>
      <div class="section-body"><p style="color:#9CA3AF;font-size:13px;">Sin gastos registrados este mes.</p></div>
    </div>`;
  }

  const bars = cats.map(([cat, amount], i) => {
    const pct = porcentaje(amount, totalG);
    const color = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6'][i] ?? '#6366F1';
    return `
      <div class="bar-row">
        <div class="bar-meta">
          <span class="bar-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          <span class="bar-amount">${fmt(amount)} · ${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <span class="section-title">Distribución de Gastos por Categoría</span>
      </div>
      <div class="section-body">${bars}</div>
    </div>
  `;
}

function seccionTransacciones(txsMes: Transaction[], filtro: ConfigReporte['filtroTipo']): string {
  let lista = [...txsMes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (filtro === 'ingresos') lista = lista.filter(t => t.type === 'income');
  if (filtro === 'gastos')   lista = lista.filter(t => t.type === 'expense');

  if (lista.length === 0) {
    return `<div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">📋</div>
        <span class="section-title">Transacciones</span>
      </div>
      <div class="section-body"><p style="color:#9CA3AF;font-size:13px;">Sin transacciones para el filtro seleccionado.</p></div>
    </div>`;
  }

  const rows = lista.slice(0, 50).map(t => {
    const d     = new Date(t.date);
    const fecha = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const isInc = t.type === 'income';
    return `
      <tr>
        <td>
          <span class="tx-cat">${t.category.charAt(0).toUpperCase() + t.category.slice(1)}</span>
          ${t.description ? `<div class="tx-desc">${t.description}</div>` : ''}
        </td>
        <td class="tx-date">${fecha}</td>
        <td><span class="tx-badge ${isInc ? 'badge-income' : 'badge-expense'}">${isInc ? 'Ingreso' : 'Gasto'}</span></td>
        <td class="${isInc ? 'tx-income' : 'tx-expense'}" style="text-align:right;">
          ${isInc ? '+' : '-'}${fmt(t.amount)}
        </td>
      </tr>
    `;
  }).join('');

  const nota = lista.length > 50 ? `<p style="color:#9CA3AF;font-size:11px;text-align:right;margin-top:10px;">Mostrando las 50 más recientes de ${lista.length} transacciones.</p>` : '';

  return `
    <div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">📋</div>
        <span class="section-title">Transacciones (${lista.length})</span>
      </div>
      <div class="section-body">
        <table class="tx-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th style="text-align:right;">Monto</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${nota}
      </div>
    </div>
  `;
}

function seccionCategorias(txsMes: Transaction[], categories: Category[]): string {
  const gastos = txsMes.filter(t => t.type === 'expense');
  const totalG = gastos.reduce((s, t) => s + t.amount, 0);

  const catMap: Record<string, number> = {};
  for (const t of gastos) {
    catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
  }

  const items = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, spent], i) => {
      const catInfo = categories.find(c => c.id === catId);
      const budget  = catInfo?.budget ?? 0;
      const pct     = budget > 0 ? Math.min(porcentaje(spent, budget), 100) : 0;
      const pctDeTotalG = porcentaje(spent, totalG);
      const color   = colorBarra(pct);

      return `
        <div class="cat-row">
          <div class="cat-rank">${i + 1}</div>
          <div class="cat-info">
            <div class="cat-name">${catId.charAt(0).toUpperCase() + catId.slice(1)}</div>
            ${budget > 0 ? `<div style="font-size:11px;color:#9CA3AF;">Presup: ${fmt(budget)}</div>` : ''}
          </div>
          <div class="cat-bar-wrap">
            ${budget > 0 ? `
              <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
              </div>
              <div style="font-size:10px;color:${color};margin-top:2px;">${pct}% usado</div>
            ` : ''}
          </div>
          <div class="cat-amount">${fmt(spent)}</div>
          <div class="cat-pct">${pctDeTotalG}%</div>
        </div>
      `;
    });

  if (items.length === 0) {
    return `<div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">🏷️</div>
        <span class="section-title">Análisis por Categoría</span>
      </div>
      <div class="section-body"><p style="color:#9CA3AF;font-size:13px;">Sin gastos registrados este mes.</p></div>
    </div>`;
  }

  return `
    <div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">🏷️</div>
        <span class="section-title">Análisis por Categoría</span>
      </div>
      <div class="section-body">${items.join('')}</div>
    </div>
  `;
}

function seccionProyeccion(txsMes: Transaction[], salary: number, goal?: DatosReporte['goal']): string {
  const ingresos    = totalTipo(txsMes, 'income');
  const gastos      = totalTipo(txsMes, 'expense');
  const ahorro      = ingresos - gastos;
  const promDiario  = gastos / 30;
  const ahorroProj  = ahorro > 0 ? ahorro * 12 : 0;
  const mesParaMeta = goal?.targetAmount && ahorro > 0 ? Math.ceil(goal.targetAmount / ahorro) : 0;

  const goalAmt     = goal?.targetAmount ?? goal?.amount ?? 0;
  const goalPct     = goalAmt > 0 ? Math.min(porcentaje(ahorroProj, goalAmt * 12), 100) : 0;

  return `
    <div class="section section-page-break">
      <div class="section-header">
        <div class="section-icon">🔮</div>
        <span class="section-title">Proyecciones Financieras</span>
      </div>
      <div class="section-body">
        <div class="proj-grid">
          <div class="proj-card">
            <div class="proj-label">Gasto promedio diario</div>
            <div class="proj-value proj-negative">${fmt(promDiario)}</div>
            <div class="proj-note">Basado en gastos del mes</div>
          </div>
          <div class="proj-card">
            <div class="proj-label">Ahorro mensual</div>
            <div class="proj-value ${ahorro >= 0 ? 'proj-positive' : 'proj-negative'}">${fmt(ahorro)}</div>
            <div class="proj-note">Ingresos – Gastos</div>
          </div>
          <div class="proj-card">
            <div class="proj-label">Ahorro proyectado anual</div>
            <div class="proj-value ${ahorroProj >= 0 ? 'proj-positive' : 'proj-negative'}">${fmt(ahorroProj)}</div>
            <div class="proj-note">A este ritmo en 12 meses</div>
          </div>
          <div class="proj-card">
            <div class="proj-label">Meses para tu meta</div>
            <div class="proj-value proj-neutral">${mesParaMeta > 0 ? mesParaMeta : '—'}</div>
            <div class="proj-note">${goalAmt > 0 ? `Meta: ${fmt(goalAmt)}` : 'Sin meta configurada'}</div>
          </div>
        </div>
        ${goalAmt > 0 ? `
          <div class="goal-section">
            <div class="goal-header">
              <span class="goal-label">${goal?.title ?? 'Progreso hacia tu meta'}</span>
              <span class="goal-pct">${goalPct}%</span>
            </div>
            <div class="goal-track">
              <div class="goal-fill" style="width:${goalPct}%;"></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generarHTMLReporte(datos: DatosReporte): string {
  const { nombreUsuario, transactions, categories, salary, goal, config } = datos;
  const { mes, año, incluirGraficos, incluirCategorias, incluirTransacciones, incluirProyeccion, filtroTipo } = config;

  const txsMes  = filtrarMes(transactions, mes, año);
  const mesNom  = MESES[mes] ?? '';
  const hoy     = new Date();
  const fechaGen = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;

  const resumen        = seccionResumen(txsMes, salary);
  const graficos       = incluirGraficos       ? seccionGraficoCategorias(txsMes)              : '';
  const transacciones  = incluirTransacciones  ? seccionTransacciones(txsMes, filtroTipo)      : '';
  const categorias     = incluirCategorias     ? seccionCategorias(txsMes, categories)         : '';
  const proyeccion     = incluirProyeccion     ? seccionProyeccion(txsMes, salary, goal)       : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte Financiero ${mesNom} ${año}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
<div class="page">

  <div class="report-header">
    <div class="header-top">
      <div class="brand">Financy<span>AI</span></div>
      <div class="header-meta">
        <div>Generado: ${fechaGen}</div>
        <div>Para: ${nombreUsuario}</div>
      </div>
    </div>
    <div class="report-title">Reporte Financiero</div>
    <div class="report-subtitle">${mesNom} ${año}</div>
  </div>

  ${resumen}
  ${graficos}
  ${categorias}
  ${transacciones}
  ${proyeccion}

  <div class="footer">
    <span class="footer-brand">FinancyAI</span>
    <span class="footer-note">Reporte generado automáticamente · ${fechaGen}</span>
  </div>

</div>
</body>
</html>`;
}
