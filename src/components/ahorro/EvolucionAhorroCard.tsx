/**
 * EvolucionAhorroCard — ahorro de cada mes contra la línea del punto de
 * partida, con hitos. Responde "¿estoy mejorando?" de un vistazo.
 *
 * Mes de arranque (parcial) y mes en curso se dibujan atenuados: se ven, pero
 * no cuentan para hitos ni para el número principal.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import {
  calcularHitos, calcularEvidenciaAhorro, rachaMesesAhorrando, textoCompartirLogro,
} from '../../utils/ahorroEvidencia';
import { CompartirLogroModal } from './CompartirLogroModal';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtShort = (n: number) => {
  const s = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)}k`;
  return `${s}$${Math.round(a)}`;
};

const H = 150;
const PAD_T = 14;
const PAD_B = 22;
const MAX_MESES = 6;

interface Props { width: number; }

export function EvolucionAhorroCard({ width }: Props) {
  const { colors } = useTheme();
  const { serieAhorro, puntoPartida } = useFinance();

  const hitos = useMemo(() => calcularHitos(serieAhorro, puntoPartida), [serieAhorro, puntoPartida]);
  const evidencia = useMemo(() => calcularEvidenciaAhorro(serieAhorro, puntoPartida), [serieAhorro, puntoPartida]);
  const racha = useMemo(() => rachaMesesAhorrando(serieAhorro), [serieAhorro]);
  const [hitoCompartir, setHitoCompartir] = useState<string | null>(null);
  const puntos = useMemo(() => {
    const inicio = Math.max(0, serieAhorro.length - MAX_MESES);
    return serieAhorro.slice(inicio).map((p, i) => ({ ...p, arranque: inicio + i === 0 }));
  }, [serieAhorro]);

  if (puntos.length === 0) return null;

  const base = puntoPartida?.ahorroMensual ?? null;
  const valores = [...puntos.map(p => p.ahorroMes), base ?? 0, 0];
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const rango = max - min || 1;
  const drawH = H - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + drawH - ((v - min) / rango) * drawH;
  const zeroY = y(0);
  const slot = width / puntos.length;
  const barW = Math.min(28, slot * 0.55);

  return (
    <View style={[st.card, { backgroundColor: colors.card }]}>
      <Text style={[st.titulo, { color: colors.textPrimary }]}>Tu ahorro mes a mes</Text>
      <Text style={[st.sub, { color: colors.textTertiary }]}>
        {base !== null
          ? `Línea punteada: tu punto de partida (${fmtShort(base)}/mes)`
          : 'Define tu punto de partida para ver cuánto mejoras'}
      </Text>

      <Svg width={width} height={H}>
        <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={colors.border} strokeWidth={1} />
        {puntos.map((p, i) => {
          const cx = i * slot + slot / 2;
          const atenuado = p.arranque || p.enCurso;
          const color = p.sinDatos ? colors.border
            : base !== null && p.ahorroMes >= base ? colors.income
            : p.ahorroMes < 0 ? colors.expense : colors.primary;
          const top = Math.min(y(p.ahorroMes), zeroY);
          const alto = Math.max(p.sinDatos ? 0 : 2, Math.abs(y(p.ahorroMes) - zeroY));
          return (
            <React.Fragment key={`${p.año}-${p.mes}`}>
              <Rect x={cx - barW / 2} y={top} width={barW} height={alto} rx={5} fill={color} opacity={atenuado ? 0.4 : 1} />
              <SvgText x={cx} y={H - 6} fontSize={9} textAnchor="middle" fill={colors.textTertiary}>
                {MESES[p.mes]}{p.enCurso ? '*' : ''}
              </SvgText>
            </React.Fragment>
          );
        })}
        {base !== null && (
          <Line x1={0} y1={y(base)} x2={width} y2={y(base)} stroke={colors.income} strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </Svg>
      <Text style={[st.nota, { color: colors.textTertiary }]}>
        Atenuado: tu mes de inicio (incompleto) y el mes en curso (*).
      </Text>

      <View style={st.hitos}>
        {hitos.map(h => (
          <Pressable
            key={h.id}
            disabled={!h.alcanzado}
            onPress={() => setHitoCompartir(h.titulo)}
            style={[st.hito, { backgroundColor: h.alcanzado ? colors.incomeLight : colors.cardSecondary ?? colors.background }]}
          >
            <Icon name={h.alcanzado ? 'award' : 'lock'} size={12} color={h.alcanzado ? colors.income : colors.textTertiary} />
            <Text style={[st.hitoText, { color: h.alcanzado ? colors.income : colors.textTertiary }]}>{h.titulo}</Text>
            {h.alcanzado && <Icon name="share-2" size={10} color={colors.income} />}
          </Pressable>
        ))}
      </View>

      <CompartirLogroModal
        visible={hitoCompartir !== null}
        onClose={() => setHitoCompartir(null)}
        texto={hitoCompartir ? textoCompartirLogro({ evidencia: evidencia, racha, hito: hitoCompartir }) : null}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 24, padding: 20, marginBottom: 16, gap: 8,
    shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, shadowRadius: 24, elevation: 3,
  },
  titulo:   { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sub:      { fontSize: 12 },
  nota:     { fontSize: 10.5 },
  hitos:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  hito:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  hitoText: { fontSize: 11, fontWeight: '600' },
});
