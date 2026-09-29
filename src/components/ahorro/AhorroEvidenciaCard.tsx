/**
 * AhorroEvidenciaCard — el número que responde "¿Finn me ayuda a ahorrar?".
 *
 * Muestra cuánto más (o menos) ahorra el usuario desde que usa la app, medido
 * contra su punto de partida con meses cerrados y registrados. Si todavía no
 * hay con qué comparar, lo dice y explica cuándo lo habrá: nunca inventa.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { calcularEvidenciaAhorro, rachaMesesAhorrando, textoCompartirLogro } from '../../utils/ahorroEvidencia';
import { CompartirLogroModal } from './CompartirLogroModal';
import { useDesgloseAhorro } from './useDesgloseAhorro';

const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CO').replace(/,/g, '.');
const fmtInput = (raw: string) => {
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
};

interface Props {
  onOpenBot?: (msg?: string) => void;
}

export function AhorroEvidenciaCard({ onOpenBot }: Props) {
  const { colors, isDark } = useTheme();
  const { serieAhorro, puntoPartida, setPuntoPartida, profile } = useFinance();
  const [ajustando, setAjustando] = useState(false);

  const ev = useMemo(() => calcularEvidenciaAhorro(serieAhorro, puntoPartida), [serieAhorro, puntoPartida]);
  // Qué hizo el mes pasado (último mes cerrado): la razón concreta detrás del número.
  const mesPasado = useMemo(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() - 1, 1); }, []);
  const desglosePasado = useDesgloseAhorro(mesPasado.getMonth(), mesPasado.getFullYear());
  const topAccion = desglosePasado?.acciones.find(a => a.tipo !== 'apartado');
  const racha = useMemo(() => rachaMesesAhorrando(serieAhorro), [serieAhorro]);
  const [compartiendo, setCompartiendo] = useState(false);
  const textoCompartir = useMemo(() => textoCompartirLogro({ evidencia: ev, racha }), [ev, racha]);

  // Sin perfil (onboarding incompleto) no hay nada que medir.
  if (!profile) return null;

  const positivo = ev.extraAcumulado >= 0;
  const acento   = ev.estado !== 'listo' ? colors.primary : positivo ? colors.income : colors.expense;
  const fondoIco = ev.estado !== 'listo' ? colors.primaryLight : positivo ? colors.incomeLight : colors.expenseLight;
  const origenBase = ev.base?.fuente === 'declarado' ? 'lo que nos contaste' : 'tu primer mes completo';

  let etiqueta: string;
  let principal: string;
  let detalle: string;
  if (ev.estado === 'listo') {
    etiqueta  = positivo ? 'Desde que usas Finn ahorraste' : 'Desde que usas Finn tu ahorro va';
    principal = positivo ? `${fmt(ev.extraAcumulado)} más` : `${fmt(ev.extraAcumulado)} por debajo`;
    detalle   = `Promedio ${fmt(ev.promedioMensual)}/mes vs ${fmt(ev.base!.ahorroMensual)}/mes de ${origenBase} · `
      + `${ev.mesesMedidos} ${ev.mesesMedidos === 1 ? 'mes medido' : 'meses medidos'}`;
  } else if (ev.estado === 'midiendo') {
    etiqueta  = 'Tu progreso con Finn';
    principal = 'Midiendo…';
    detalle   = `Tu punto de partida es ${fmt(ev.base!.ahorroMensual)}/mes (${origenBase}). `
      + 'Al cerrar el mes verás cuánto más ahorras.';
  } else {
    etiqueta  = 'Tu progreso con Finn';
    principal = '¿Cuánto ahorrabas antes?';
    detalle   = 'Cuéntanos para medir cuánto mejoras. Si no lo sabes, lo calculamos al cerrar tu primer mes completo.';
  }

  const pedirPlan = () => onOpenBot?.(
    `Finn, mi ahorro va ${fmt(ev.extraAcumulado)} por debajo de mi punto de partida. ¿Qué puedo ajustar este mes?`,
  );

  return (
    <>
      <Pressable
        testID="ahorro-evidencia-card"
        onPress={() => { Haptics.selectionAsync(); setAjustando(true); }}
        style={[st.card, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border }]}
      >
        <View style={[st.ico, { backgroundColor: fondoIco }]}>
          <Icon name={ev.estado === 'listo' && !positivo ? 'trending-down' : 'trending-up'} size={18} color={acento} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[st.etiqueta, { color: colors.textTertiary, flexShrink: 1 }]}>{etiqueta}</Text>
            {racha >= 2 && (
              <View testID="racha-ahorro-chip" style={[st.racha, { backgroundColor: colors.incomeLight }]}>
                <Icon name="zap" size={10} color={colors.income} />
                <Text style={[st.rachaText, { color: colors.income }]}>{racha} meses seguidos</Text>
              </View>
            )}
          </View>
          <Text style={[st.principal, { color: acento }]} numberOfLines={1} adjustsFontSizeToFit>{principal}</Text>
          <Text style={[st.detalle, { color: colors.textSecondary }]}>{detalle}</Text>
          {desglosePasado && desglosePasado.gastoEvitado > 0 && (
            <Text style={[st.detalle, { color: colors.income, fontWeight: '600', marginTop: 2 }]} numberOfLines={2}>
              El mes pasado evitaste {fmt(desglosePasado.gastoEvitado)} de gasto
              {topAccion ? ` · ${topAccion.titulo.charAt(0).toLowerCase()}${topAccion.titulo.slice(1)}` : ''}
            </Text>
          )}
          {ev.estado === 'listo' && !positivo && onOpenBot && (
            <Pressable onPress={pedirPlan} hitSlop={8} style={{ marginTop: 6 }}>
              <Text style={[st.cta, { color: colors.primary }]}>Pedirle un plan a Finn</Text>
            </Pressable>
          )}
          {textoCompartir && (
            <Pressable testID="compartir-progreso" onPress={() => setCompartiendo(true)} hitSlop={8}
              style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="share-2" size={12} color={colors.primary} />
              <Text style={[st.cta, { color: colors.primary }]}>Compartir mi progreso</Text>
            </Pressable>
          )}
        </View>
        <Icon name="sliders" size={15} color={colors.textTertiary} />
      </Pressable>

      <AjustarPuntoPartida
        visible={ajustando}
        onClose={() => setAjustando(false)}
        actual={profile.puntoPartida?.fuente === 'declarado' ? profile.puntoPartida.ahorroMensual : null}
        calculado={ev.base?.fuente === 'calculado' ? ev.base.ahorroMensual : null}
        onGuardar={monto => { setPuntoPartida(monto); setAjustando(false); }}
      />
      <CompartirLogroModal visible={compartiendo} onClose={() => setCompartiendo(false)} texto={textoCompartir} />
    </>
  );
}

interface AjustarProps {
  visible: boolean;
  onClose: () => void;
  /** Valor declarado actual (null si no declaró). */
  actual: number | null;
  /** Base calculada vigente, para mostrarla como referencia. */
  calculado: number | null;
  /** monto = declarar · null = volver al cálculo automático. */
  onGuardar: (monto: number | null) => void;
}

function AjustarPuntoPartida({ visible, onClose, actual, calculado, onGuardar }: AjustarProps) {
  const { colors } = useTheme();
  const [valor, setValor] = useState(actual !== null ? fmtInput(String(actual)) : '');

  React.useEffect(() => {
    if (visible) setValor(actual !== null ? fmtInput(String(actual)) : '');
  }, [visible, actual]);

  const monto = parseInt(valor.replace(/\./g, ''), 10);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[st.sheetTitle, { color: colors.textPrimary }]}>Tu punto de partida</Text>
            <Text style={[st.sheetSub, { color: colors.textSecondary }]}>
              ¿Cuánto lograbas ahorrar al mes antes de usar Finn? Con esto medimos cuánto mejoras.
            </Text>
            <View style={[st.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={{ color: colors.textTertiary, fontSize: 18 }}>$</Text>
              <TextInput
                testID="punto-partida-input"
                style={[st.input, { color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={valor}
                onChangeText={t => setValor(fmtInput(t))}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>/mes</Text>
            </View>
            <Pressable
              testID="punto-partida-guardar"
              disabled={valor === '' || isNaN(monto)}
              onPress={() => onGuardar(monto)}
              style={[st.btn, { backgroundColor: colors.primary, opacity: valor === '' ? 0.4 : 1 }]}
            >
              <Text style={st.btnText}>Guardar</Text>
            </Pressable>
            <Pressable onPress={() => onGuardar(null)} style={st.btnSec} hitSlop={6}>
              <Text style={[st.btnSecText, { color: colors.primary }]}>
                {calculado !== null
                  ? `Usar mi primer mes completo (${fmt(calculado)}/mes)`
                  : 'No lo sé: calcúlalo con mi primer mes completo'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16,
    ...Platform.select({
      ios:     { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 24 },
      android: { elevation: 2 },
    }),
  },
  ico:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  etiqueta:  { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  principal: { fontSize: 22, fontWeight: '800' },
  detalle:   { fontSize: 12, lineHeight: 17 },
  cta:       { fontSize: 12.5, fontWeight: '700' },
  racha:     { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 },
  rachaText: { fontSize: 10, fontWeight: '700' },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet:     { borderRadius: 20, padding: 20, gap: 12 },
  sheetTitle:{ fontSize: 17, fontWeight: '700' },
  sheetSub:  { fontSize: 13, lineHeight: 19 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  input:     { flex: 1, fontSize: 18, fontWeight: '600' },
  btn:       { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSec:    { alignItems: 'center', paddingVertical: 4 },
  btnSecText:{ fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
