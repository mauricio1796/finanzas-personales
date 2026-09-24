import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { LegalDocumentView } from '../../components/legal/LegalDocumentView';
import { getLegalDocument, type LegalDocId } from '../../legal';

interface Props {
  docId: LegalDocId;
  onBack: () => void;
}

/** Documento legal a pantalla completa dentro del navegador de la app. */
export function LegalScreen({ docId, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title={getLegalDocument(docId).shortTitle} onBack={onBack} />
      <LegalDocumentView docId={docId} bottomInset={insets.bottom} />
    </View>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
