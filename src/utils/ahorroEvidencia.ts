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

/** Punto de partida declarado a partir de lo que el usuario escribió. */
export function puntoPartidaDeclarado(ahorroMensual: number, ahora: Date = new Date()): PuntoPartida {
  return {
    ahorroMensual: Math.max(0, Math.round(ahorroMensual)),
    fuente:        'declarado',
    fecha:         ahora.toISOString(),
  };
}
