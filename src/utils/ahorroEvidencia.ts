/**
 * Evidencia de ahorro: cuánto cambió el ahorro del usuario desde que usa Finn.
 *
 * Todo se mide contra un punto de partida (línea base) y con la serie de ahorro
 * REAL del motor (`getSerieAhorro`): solo lo registrado, meses sin datos no
 * cuentan. Si no hay base honesta contra la cual comparar, no se afirma nada.
 *
 * Módulo puro (solo imports de tipos): recibe la serie ya calculada y se prueba
 * con `node --test` en tests/ahorroEvidencia.test.ts.
 */

import type { PuntoPartida } from '../types';
import type { PuntoAhorro } from './ingresoUtils';

const inicioMes = (mes: number, año: number) => new Date(año, mes, 1).toISOString();

/**
 * Punto de partida vigente:
 *   1. El declarado por el usuario (onboarding o ajuste manual).
 *   2. Si no hay, su primer mes COMPLETO registrado: el mes en que empezó a
 *      registrar casi siempre está a medias (entró a mitad de mes) y su
 *      "ahorro" saldría inflado, así que se usa el siguiente mes con datos.
 *   3. Si aún no cerró un mes completo, null: todavía no hay contra qué medir.
 *
 * `serie` debe venir de getSerieAhorro con suficientes meses (p. ej. 24).
 */
export function resolverPuntoPartida(
  declarado: PuntoPartida | undefined | null,
  serie: PuntoAhorro[],
): PuntoPartida | null {
  if (declarado && isFinite(declarado.ahorroMensual)) return declarado;
  // serie[0] es el mes en que empezó a registrar (parcial): se salta.
  const base = serie.slice(1).find(p => !p.sinDatos && !p.enCurso);
  if (!base) return null;
  return {
    ahorroMensual: base.ahorroMes,
    fuente:        'calculado',
    fecha:         inicioMes(base.mes, base.año),
  };
}

export interface EvidenciaAhorro {
  /**
   * sin_base: aún no hay punto de partida (ni declarado ni un mes completo).
   * midiendo: hay base pero ningún mes cerrado posterior para comparar.
   * listo:    hay meses medidos.
   */
  estado: 'sin_base' | 'midiendo' | 'listo';
  base: PuntoPartida | null;
  /** Σ (ahorro del mes − base) en los meses medidos. Puede ser negativo. */
  extraAcumulado: number;
  /** Promedio de ahorro mensual en los meses medidos. */
  promedioMensual: number;
  /** promedioMensual − base. */
  mejoraMensual: number;
  mesesMedidos: number;
  /** Meses medidos (para gráficas y desglose). */
  meses: PuntoAhorro[];
}

/**
 * Meses que cuentan para medir el cambio: cerrados, con registros, sin el mes
 * de arranque (parcial) y, si la base es calculada, posteriores al mes base
 * (el mes base es la base: compararlo consigo mismo no dice nada).
 */
export function mesesMedibles(serie: PuntoAhorro[], base: PuntoPartida): PuntoAhorro[] {
  const desde = new Date(base.fecha);
  const claveDesde = desde.getFullYear() * 12 + desde.getMonth();
  return serie.slice(1).filter(p => {
    if (p.sinDatos || p.enCurso) return false;
    const clave = p.año * 12 + p.mes;
    return base.fuente === 'calculado' ? clave > claveDesde : clave >= claveDesde;
  });
}

/** El número que la app muestra: cuánto más (o menos) ahorra desde que usa Finn. */
export function calcularEvidenciaAhorro(
  serie: PuntoAhorro[],
  base: PuntoPartida | null,
): EvidenciaAhorro {
  const vacio = { extraAcumulado: 0, promedioMensual: 0, mejoraMensual: 0, mesesMedidos: 0, meses: [] };
  if (!base) return { estado: 'sin_base', base: null, ...vacio };
  const meses = mesesMedibles(serie, base);
  if (meses.length === 0) return { estado: 'midiendo', base, ...vacio };

  const total = meses.reduce((s, p) => s + p.ahorroMes, 0);
  const promedioMensual = total / meses.length;
  return {
    estado:          'listo',
    base,
    extraAcumulado:  total - base.ahorroMensual * meses.length,
    promedioMensual,
    mejoraMensual:   promedioMensual - base.ahorroMensual,
    mesesMedidos:    meses.length,
    meses,
  };
}

/** Punto de partida declarado a partir de lo que el usuario escribió. */
export function puntoPartidaDeclarado(ahorroMensual: number, ahora: Date = new Date()): PuntoPartida {
  return {
    ahorroMensual: Math.max(0, Math.round(ahorroMensual)),
    fuente:        'declarado',
    fecha:         ahora.toISOString(),
  };
}
