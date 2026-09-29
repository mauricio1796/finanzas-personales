/**
 * DesgloseAhorroCard — "Finn te ayudó este mes": qué decisiones concretas
 * explican el ahorro (gastar menos que tu promedio, compras evitadas, lo
 * apartado para metas). Se oculta si no hay nada que mostrar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { useDesgloseAhorro } from './useDesgloseAhorro';
import type { AccionAhorro } from '../../utils/ahorroEvidencia';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

const ICONO: Record<AccionAhorro['tipo'], string> = {
  gasto_menor:    'trending-down',
  compra_evitada: 'x-circle',
  apartado:       'lock',
};

interface Props {
  mes: number;
  año: number;
}

export function DesgloseAhorroCard({ mes, año }: Props) {
  const { colors } = useTheme();
  const desglose = useDesgloseAhorro(mes, año);
  if (!desglose || desglose.acciones.length === 0) return null;

  return (
    <View testID="desglose-ahorro-card" style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[st.titulo, { color: colors.textPrimary }]}>
        {desglose.gastoEvitado > 0
          ? `Finn te ayudó a evitar ${fmt(desglose.gastoEvitado)} de gasto`
          : 'Lo que hiciste por tu ahorro'}
      </Text>
      {desglose.acciones.map((a, i) => (
        <View key={`${a.tipo}-${i}`} style={st.fila}>
          <View style={[st.ico, { backgroundColor: colors.incomeLight }]}>
            <Icon name={ICONO[a.tipo] as any} size={14} color={colors.income} />
          </View>
          <Text style={[st.texto, { color: colors.textSecondary }]} numberOfLines={2}>{a.titulo}</Text>
          <Text style={[st.monto, { color: colors.income }]}>{fmt(a.monto)}</Text>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  card:   { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 16 },
  titulo: { fontSize: 15, fontWeight: '700' },
  fila:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ico:    { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  texto:  { flex: 1, fontSize: 13, lineHeight: 18 },
  monto:  { fontSize: 13.5, fontWeight: '700' },
});
