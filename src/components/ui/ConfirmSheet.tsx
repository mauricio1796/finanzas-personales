/**
 * ConfirmSheet — confirmación tranquila para acciones destructivas.
 *
 * Hoja inferior (centrada en web), ícono de línea pequeño, texto claro y dos
 * botones sobrios: el destructivo usa un fondo rojo suave con texto rojo, no un
 * bloque rojo sólido. Reemplaza al Alert del sistema y al "sticker" 🗑️.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { Icon, type FeatherName } from './Icon';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  /** Texto del botón de confirmación. */
  confirmLabel?: string;
  /** true = acción destructiva (rojo suave); false = acción neutra (color primario). */
  destructive?: boolean;
  icon?: FeatherName;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible, title, message, confirmLabel = 'Eliminar', destructive = true,
  icon = 'trash-2', onConfirm, onCancel,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tint     = destructive ? colors.danger : colors.primary;
  const tintSoft = destructive ? colors.dangerLight : colors.primaryLight;
  const isWeb = Platform.OS === 'web';

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable
        style={[s.overlay, { backgroundColor: colors.overlay }, isWeb && s.overlayWeb]}
        onPress={onCancel}
        accessibilityLabel="Cerrar"
      >
        {/* Evita que un toque dentro de la hoja la cierre */}
        <Pressable
          style={[
            s.sheet,
            { backgroundColor: colors.card, paddingBottom: isWeb ? 20 : Math.max(insets.bottom, 12) + 12 },
            isWeb && s.sheetWeb,
          ]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          {!isWeb && <View style={[s.handle, { backgroundColor: colors.border }]} />}

          <View style={s.header}>
            <View style={[s.iconWrap, { backgroundColor: tintSoft }]}>
              <Icon name={icon} size={16} color={tint} />
            </View>
            <Text style={[s.title, { color: colors.textPrimary }]} accessibilityRole="header">{title}</Text>
          </View>

          {message ? <Text style={[s.message, { color: colors.textSecondary }]}>{message}</Text> : null}

          <View style={s.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[s.btn, { backgroundColor: colors.cardSecondary }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              testID="confirm-sheet-cancel"
            >
              <Text style={[s.btnText, { color: colors.textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[s.btn, { backgroundColor: tintSoft }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              testID="confirm-sheet-confirm"
            >
              <Text style={[s.btnText, { color: tint }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  overlayWeb: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:      { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10 },
  sheetWeb:   { width: '100%', maxWidth: 380, borderRadius: 20, paddingTop: 20 },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, fontSize: 16, fontWeight: '600' },
  message:    { fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions:    { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn:        { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText:    { fontSize: 15, fontWeight: '600' },
});
