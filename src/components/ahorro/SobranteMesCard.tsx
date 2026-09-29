/**
 * SobranteMesCard — al cierre del mes, convierte lo que sobró en ahorro real:
 * "Te sobraron $X, ¿los apartas a tu meta?". El abono crea el movimiento
 * "Ahorro" con fecha de ESE mes, así el sobrante no se descuenta del mes nuevo.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { metaPrincipal } from '../../utils/metasUtils';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface Props {
  mes: number;
  año: number;
  /** Lo que quedó disponible ese mes (ver sobranteParaApartar). */
  sobrante: number;
  onIrAMetas?: () => void;
}

export function SobranteMesCard({ mes, año, sobrante, onIrAMetas }: Props) {
  const { colors } = useTheme();
  const { metas, abonarMeta } = useFinance();
  const [apartado, setApartado] = useState<number | null>(null);

  const activas = metas.filter(m => !m.completada);
  const meta = metaPrincipal(activas);

  if (apartado !== null) {
    return (
      <View style={[st.card, { backgroundColor: colors.incomeLight, borderColor: colors.income + '40' }]}>
        <Icon name="check-circle" size={18} color={colors.income} />
        <Text style={[st.texto, { color: colors.textPrimary, flex: 1 }]}>
          Apartaste {fmt(apartado)} para "{meta?.nombre}". Ese dinero ya trabaja por tu meta.
        </Text>
      </View>
    );
  }
  if (sobrante < 1000) return null;

  const hoy = new Date();
  const esMesEnCurso = hoy.getMonth() === mes && hoy.getFullYear() === año;
  // Mes cerrado: el abono queda en su último día para no restarle al mes nuevo.
  const fecha = esMesEnCurso ? hoy : new Date(año, mes + 1, 0, 12);

  const apartar = () => {
    if (!meta) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    abonarMeta(meta.id, sobrante, fecha);
    setApartado(sobrante);
  };

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[st.ico, { backgroundColor: colors.incomeLight }]}>
        <Icon name="gift" size={18} color={colors.income} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[st.titulo, { color: colors.textPrimary }]}>
          {esMesEnCurso ? `Te van sobrando ${fmt(sobrante)}` : `Te sobraron ${fmt(sobrante)}`}
        </Text>
        <Text style={[st.texto, { color: colors.textSecondary }]}>
          {meta
            ? `Apártalos para "${meta.nombre}" y conviértelos en ahorro de verdad.`
            : 'Crea una meta para apartarlos y convertirlos en ahorro de verdad.'}
        </Text>
        <Pressable
          testID="sobrante-apartar"
          onPress={meta ? apartar : onIrAMetas}
          style={[st.btn, { backgroundColor: colors.income }]}
        >
          <Text style={st.btnText}>{meta ? `Apartar ${fmt(sobrante)}` : 'Crear una meta'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  ico:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 15, fontWeight: '700' },
  texto:  { fontSize: 12.5, lineHeight: 18 },
  btn:    { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2 },
  btnText:{ color: '#fff', fontSize: 13, fontWeight: '700' },
});
