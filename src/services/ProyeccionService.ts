export interface PuntoGrafica { mes: number; valor: number; }
export interface ResultadoProyeccion {
  titulo: string; valorPrincipal: string;
  lineasTiempo: PuntoGrafica[]; insights: string[];
}

export function calcularMeta(ahorroMensual: number, metaTotal: number, rendimientoAnual = 0.11): ResultadoProyeccion {
  const rm = rendimientoAnual / 12;
  let acumulado = 0;
  const puntos: PuntoGrafica[] = [];
  let meses = 0;
  while (acumulado < metaTotal && meses < 360) {
    acumulado = acumulado * (1 + rm) + ahorroMensual;
    meses++;
    if (meses % 3 === 0) puntos.push({ mes: meses, valor: acumulado });
  }
  const anos = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  const tiempoLabel = anos > 0
    ? (anos + ' ano' + (anos > 1 ? 's' : '') + (mesesRest > 0 ? ' y ' + mesesRest + ' meses' : ''))
    : (meses + ' meses');
  return {
    titulo: 'Tiempo para alcanzar tu meta',
    valorPrincipal: tiempoLabel,
    lineasTiempo: puntos,
    insights: [
      'Ahorrando $' + Math.round(ahorroMensual).toLocaleString('es-CO').replace(/,/g, '.') + '/mes con CDT al ' + Math.round(rendimientoAnual * 100) + '% EA',
      'Total aportado: $' + Math.round(ahorroMensual * meses).toLocaleString('es-CO').replace(/,/g, '.'),
      'Intereses ganados: $' + Math.round(acumulado - ahorroMensual * meses).toLocaleString('es-CO').replace(/,/g, '.'),
    ],
  };
}

export function calcularCredito(monto: number, tasaMensual: number, plazoMeses: number): ResultadoProyeccion {
  const cuota = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / (Math.pow(1 + tasaMensual, plazoMeses) - 1);
  const totalPagado = cuota * plazoMeses;
  const totalIntereses = totalPagado - monto;
  let saldo = monto;
  const puntos: PuntoGrafica[] = [{ mes: 0, valor: monto }];
  for (let i = 1; i <= plazoMeses; i++) {
    saldo -= (cuota - saldo * tasaMensual);
    if (i % 3 === 0 || i === plazoMeses) puntos.push({ mes: i, valor: Math.max(0, saldo) });
  }
  return {
    titulo: 'Costo real del credito',
    valorPrincipal: '$' + Math.round(cuota).toLocaleString('es-CO').replace(/,/g, '.') + '/mes',
    lineasTiempo: puntos,
    insights: [
      'Cuota mensual: $' + Math.round(cuota).toLocaleString('es-CO').replace(/,/g, '.'),
      'Total a pagar en ' + plazoMeses + ' meses: $' + Math.round(totalPagado).toLocaleString('es-CO').replace(/,/g, '.'),
      'Total intereses: $' + Math.round(totalIntereses).toLocaleString('es-CO').replace(/,/g, '.') + ' (' + ((totalIntereses / monto) * 100).toFixed(1) + '% del capital)',
      totalIntereses > monto * 0.3 ? 'Pagas mas del 30% en intereses. Considera un plazo menor.' : 'Costo de financiacion razonable.',
    ],
  };
}

export interface CuotaAmortizacion {
  mes: number;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
}

export function calcularAmortizacion(saldo: number, tasaMensual: number, cuota: number, maxMeses = 12): CuotaAmortizacion[] {
  const rows: CuotaAmortizacion[] = [];
  let s = saldo;
  for (let i = 1; i <= maxMeses && s > 0; i++) {
    const interes  = s * (tasaMensual / 100);
    const capital  = Math.min(cuota - interes, s);
    s = Math.max(0, s - capital);
    rows.push({ mes: i, cuota: Math.round(cuota), capital: Math.round(capital), interes: Math.round(interes), saldo: Math.round(s) });
  }
  return rows;
}

export function calcularPromedioCategoria(transactions: { amount: number; category: string; type: string; date: string }[], categoria: string, meses = 3): number {
  const ahora = new Date();
  const corte = new Date(ahora.getFullYear(), ahora.getMonth() - meses, 1);
  const filtradas = transactions.filter(t => t.type === 'expense' && t.category === categoria && new Date(t.date) >= corte);
  if (!filtradas.length) return 0;
  const total = filtradas.reduce((a, t) => a + t.amount, 0);
  return total / meses;
}

export function detectarTendencia(transactions: { amount: number; category: string; type: string; date: string }[]): { categoria: string; promedio: number; tendencia: 'sube' | 'baja' | 'estable' }[] {
  const gastos = transactions.filter(t => t.type === 'expense');
  const cats = [...new Set(gastos.map(t => t.category))];
  const ahora = new Date();
  return cats.map(cat => {
    const txMes1 = gastos.filter(t => {
      const d = new Date(t.date);
      return t.category === cat && d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    }).reduce((a, t) => a + t.amount, 0);
    const mesAnterior = ahora.getMonth() === 0 ? 11 : ahora.getMonth() - 1;
    const anioAnterior = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();
    const txMes0 = gastos.filter(t => {
      const d = new Date(t.date);
      return t.category === cat && d.getMonth() === mesAnterior && d.getFullYear() === anioAnterior;
    }).reduce((a, t) => a + t.amount, 0);
    const diff = txMes0 > 0 ? (txMes1 - txMes0) / txMes0 : 0;
    return {
      categoria: cat,
      promedio: calcularPromedioCategoria(transactions, cat, 3),
      tendencia: diff > 0.1 ? 'sube' : diff < -0.1 ? 'baja' : 'estable',
    };
  }).filter(r => r.promedio > 0).sort((a, b) => b.promedio - a.promedio).slice(0, 5);
}

export function proyectarMesProximo(transactions: { amount: number; category: string; type: string; date: string }[], ingreso: number): ResultadoProyeccion {
  const tendencias = detectarTendencia(transactions);
  const gastoProyectado = tendencias.reduce((a, t) => a + t.promedio, 0);
  const ahorro = ingreso - gastoProyectado;
  const meses = 6;
  return {
    titulo: 'Proyección próximo mes',
    valorPrincipal: '$' + Math.round(gastoProyectado).toLocaleString('es-CO').replace(/,/g, '.'),
    lineasTiempo: Array.from({ length: meses }, (_, i) => ({
      mes: i + 1,
      valor: Math.round(gastoProyectado * (1 + i * 0.02)),
    })),
    insights: [
      'Gasto proyectado: $' + Math.round(gastoProyectado).toLocaleString('es-CO').replace(/,/g, '.'),
      ahorro > 0
        ? 'Podrías ahorrar $' + Math.round(ahorro).toLocaleString('es-CO').replace(/,/g, '.') + ' este mes'
        : 'Gastos superan ingresos en $' + Math.round(-ahorro).toLocaleString('es-CO').replace(/,/g, '.'),
      ...tendencias.filter(t => t.tendencia === 'sube').map(t => t.categoria + ' va en aumento — revisa tu presupuesto'),
    ].slice(0, 3),
  };
}

export function simularReduccion(gastoActual: number, reduccionPct: number, meses: number, ingreso: number): ResultadoProyeccion {
  const ahorroPorMes = gastoActual * (reduccionPct / 100);
  const totalAhorrado = ahorroPorMes * meses;
  return {
    titulo: 'Si reduces gastos un ' + reduccionPct + '%',
    valorPrincipal: '+$' + Math.round(ahorroPorMes).toLocaleString('es-CO').replace(/,/g, '.') + '/mes',
    lineasTiempo: Array.from({ length: Math.min(meses, 12) }, (_, i) => ({ mes: i + 1, valor: ahorroPorMes * (i + 1) })),
    insights: [
      'Ahorras $' + Math.round(ahorroPorMes).toLocaleString('es-CO').replace(/,/g, '.') + ' adicionales cada mes',
      'En ' + meses + ' meses acumularias: $' + Math.round(totalAhorrado).toLocaleString('es-CO').replace(/,/g, '.'),
      'Nueva tasa de ahorro: ' + (((ingreso - gastoActual + ahorroPorMes) / ingreso) * 100).toFixed(1) + '%',
    ],
  };
}
