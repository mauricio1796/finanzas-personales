/**
 * LegalModal — muestra un documento legal sobre cualquier pantalla, incluso
 * antes de iniciar sesión (registro, ConsentGate), donde aún no existe el
 * navegador interno de la app.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { LegalDocumentView } from './LegalDocumentView';
import { getLegalDocument, type LegalDocId } from '../../legal';

interface Props {
  docId: LegalDocId | null;
  onClose: () => void;
}

export function LegalModal({ docId, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!docId} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {docId ? getLegalDocument(docId).shortTitle : ''}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[s.close, { backgroundColor: colors.cardSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar documento"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {docId && <LegalDocumentView docId={docId} bottomInset={insets.bottom} />}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  close:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
