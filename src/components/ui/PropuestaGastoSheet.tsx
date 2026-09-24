/**
 * Hoja de confirmación de lo que Finn entendió por voz.
 *
 * Sustituye al camino anterior, en el que lo dictado caía directo en el
 * formulario de alta rápida y, si la categoría no existía, se seleccionaba en
 * silencio la primera de la lista.
 *
 * Aquí siempre se ve QUÉ se va a guardar y DÓNDE antes de confirmar, y el botón
 * primario sale de `propuesta.accionPrimaria` — la decisión se toma en lógica
 * pura, no aquí.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, TouchableOpacity, Platform,
} from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { etiquetaAccion, type PropuestaGasto } from '../../utils/propuestaGasto';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

interface Props {
  visible:   boolean;
  propuesta: PropuestaGasto | null;
  /** Confirmar: guardar (creando la categoría si la propuesta lo indica). */
  onConfirmar: (p: PropuestaGasto) => void;
  /** Abrir el formulario completo para ajustar lo que haga falta. */
  onAjustar:   (p: PropuestaGasto) => void;
  onCerrar:    () => void;
}

export const PropuestaGastoSheet: React.FC<Props> = ({
  visible, propuesta, onConfirmar, onAjustar, onCerrar,
}) => {
  const { colors } = useTheme();
  // `useState` con inicializador perezoso en vez de `useRef(...).current`: crea
  // el valor una sola vez y con identidad estable, sin leer una ref durante el
  // render (que es lo que marca la regla react-hooks/refs).
  const [slideAnim]  = useState(() => new Animated.Value(400));
  const [backdropOp] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(400);
      backdropOp.setValue(0);
    }
  }, [visible, slideAnim, backdropOp]);

  if (!propuesta) return null;

  const esIngreso = propuesta.tipo === 'income';
  const colorMonto = esIngreso ? colors.income : colors.expense;
  const debeCompletar = propuesta.accionPrimaria === 'completar';

  // Cómo se describe el destino del gasto según lo que Finn pudo resolver.
  const destino = (() => {
    switch (propuesta.categoria.estado) {
      case 'existente':
        return { icono: 'folder', texto: propuesta.categoria.categoria.name, nota: null as string | null };
      case 'nueva':
        return {
          icono: propuesta.categoria.icono,
          texto: propuesta.categoria.nombre,
          nota: propuesta.categoria.budgetSugerido > 0
            ? `Categoría nueva · presupuesto sugerido ${fmtCOP(propuesta.categoria.budgetSugerido)}`
            : 'Categoría nueva',
        };
      case 'sin_resolver':
        return { icono: 'help-circle', texto: 'Sin categoría', nota: 'Elige dónde guardarlo' };
    }
  })();

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCerrar}>
      <View style={st.root}>
        <TouchableOpacity style={st.backdropTouch} activeOpacity={1} onPress={onCerrar}>
          <Animated.View style={[st.backdrop, { opacity: backdropOp, backgroundColor: colors.overlay }]} />
        </TouchableOpacity>

        <Animated.View
          style={[st.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={[st.handle, { backgroundColor: colors.border }]} />

          <View style={st.encabezado}>
            <View style={[st.avatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[st.avatarTexto, { color: colors.primary }]}>FI</Text>
            </View>
            <Text style={[st.titulo, { color: colors.textSecondary }]}>Finn entendió</Text>
          </View>

          {/* Monto */}
          <Text style={[st.monto, { color: colorMonto }]}>
            {debeCompletar && propuesta.monto <= 0 ? '—' : `${esIngreso ? '+' : '-'}${fmtCOP(propuesta.monto)}`}
          </Text>
          <Text style={[st.descripcion, { color: colors.textPrimary }]} numberOfLines={2}>
            {propuesta.descripcion}
          </Text>

          {propuesta.montoInferido && propuesta.referenciaInferida && (
            <View style={[st.avisoInferido, { backgroundColor: colors.cardSecondary }]}>
              <Icon name="clock" size={12} color={colors.textTertiary} />
              <Text style={[st.avisoTexto, { color: colors.textSecondary }]}>
                Mismo monto que “{propuesta.referenciaInferida}”. Toca Ajustar si cambió.
              </Text>
            </View>
          )}

          {/* Destino */}
          <View style={[st.destino, { borderColor: colors.border }]}>
            <View style={[st.destinoIcono, { backgroundColor: colors.cardSecondary }]}>
              <Icon name={destino.icono as any} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.destinoTexto, { color: colors.textPrimary }]}>{destino.texto}</Text>
              {destino.nota && (
                <Text style={[st.destinoNota, { color: colors.textTertiary }]}>{destino.nota}</Text>
              )}
            </View>
          </View>

          {/* Acciones */}
          <View style={st.acciones}>
            <TouchableOpacity
              style={[st.btnSecundario, { borderColor: colors.border }]}
              onPress={() => onAjustar(propuesta)}
              activeOpacity={0.8}
            >
              <Text style={[st.btnSecundarioTexto, { color: colors.textSecondary }]}>Ajustar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[st.btnPrimario, { backgroundColor: debeCompletar ? colors.cardSecondary : colors.primary }]}
              onPress={() => (debeCompletar ? onAjustar(propuesta) : onConfirmar(propuesta))}
              activeOpacity={0.85}
            >
              <Text
                style={[st.btnPrimarioTexto, { color: debeCompletar ? colors.textSecondary : '#fff' }]}
                numberOfLines={1}
              >
                {etiquetaAccion(propuesta, fmtCOP)}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root:          { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdrop:      { flex: 1 },
  sheet: {
    borderTopLeftRadius:  THEME.radius.lg,
    borderTopRightRadius: THEME.radius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 10,
  },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  encabezado:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar:      { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 10, fontWeight: '700' },
  titulo:      { fontSize: 12, fontWeight: '500' },
  monto:       { fontSize: 32, fontWeight: '700', marginTop: 4 },
  descripcion: { fontSize: 14, fontWeight: '500' },
  avisoInferido: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: THEME.radius.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  avisoTexto:  { fontSize: 11, flex: 1, lineHeight: 15 },
  destino: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 0.5, borderRadius: THEME.radius.md, padding: 10, marginTop: 2,
  },
  destinoIcono: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  destinoTexto: { fontSize: 14, fontWeight: '500' },
  destinoNota:  { fontSize: 11, marginTop: 1 },
  acciones:     { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnSecundario: {
    flex: 1, borderWidth: 0.5, borderRadius: THEME.radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  btnSecundarioTexto: { fontSize: 14, fontWeight: '500' },
  btnPrimario: {
    flex: 2, borderRadius: THEME.radius.md, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimarioTexto: { fontSize: 14, fontWeight: '600' },
});
