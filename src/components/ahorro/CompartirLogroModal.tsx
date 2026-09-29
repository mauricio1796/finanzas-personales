/**
 * CompartirLogroModal — vista previa de lo que se va a compartir. Deja claro
 * que no incluye montos antes de abrir la hoja de compartir del sistema.
 */

import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';

interface Props {
  visible: boolean;
  onClose: () => void;
  texto: string | null;
}

export function CompartirLogroModal({ visible, onClose, texto }: Props) {
  const { colors } = useTheme();
  if (!texto) return null;

  const compartir = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({ message: texto, title: 'Mi progreso con Finn' });
    } catch { /* el usuario canceló o el sistema no pudo compartir */ }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable style={[st.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[st.titulo, { color: colors.textPrimary }]}>Comparte tu progreso</Text>
          <View style={[st.preview, { backgroundColor: colors.primary }]}>
            <Text style={st.previewText}>{texto}</Text>
          </View>
          <View style={st.nota}>
            <Icon name="shield" size={13} color={colors.textTertiary} />
            <Text style={[st.notaText, { color: colors.textTertiary }]}>
              No incluye montos: solo tu progreso. Tú eliges con quién compartirlo.
            </Text>
          </View>
          <Pressable testID="compartir-logro-btn" onPress={compartir} style={[st.btn, { backgroundColor: colors.primary }]}>
            <Icon name="share-2" size={16} color="#fff" />
            <Text style={st.btnText}>Compartir</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet:       { borderRadius: 20, padding: 20, gap: 14 },
  titulo:      { fontSize: 17, fontWeight: '700' },
  preview:     { borderRadius: 16, padding: 18 },
  previewText: { color: '#fff', fontSize: 15, lineHeight: 23, fontWeight: '600' },
  nota:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notaText:    { flex: 1, fontSize: 12, lineHeight: 17 },
  btn:         { flexDirection: 'row', gap: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
