/**
 * LegalDocumentView — lectura cómoda de un documento legal.
 *
 * Jerarquía clara (título › resumen › secciones numeradas), ancho de lectura
 * limitado en web, tipografía de 15/23 y soporte de tema claro/oscuro.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import {
  getLegalDocument,
  LEGAL_IS_DRAFT,
  LEGAL_STATUS_NOTE,
  type LegalDocId,
} from '../../legal';

interface Props {
  docId: LegalDocId;
  /** Contenido extra al final (p. ej. botones de acción). */
  footer?: React.ReactNode;
  bottomInset?: number;
}

export function LegalDocumentView({ docId, footer, bottomInset = 24 }: Props) {
  const { colors } = useTheme();
  const doc = getLegalDocument(docId);

  return (
    <ScrollView
      contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 24 }]}
      showsVerticalScrollIndicator={false}
      testID={`legal-doc-${docId}`}
    >
      <View style={s.column}>
        <Text style={[s.title, { color: colors.textPrimary }]} accessibilityRole="header">
          {doc.title}
        </Text>
        <Text style={[s.meta, { color: colors.textTertiary }]}>
          Versión {doc.version} · Vigente desde {doc.effectiveDate}
        </Text>

        {LEGAL_IS_DRAFT && (
          <View style={[s.draft, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <Icon name="alert-triangle" size={14} color={colors.warningText} />
            <Text style={[s.draftText, { color: colors.warningText }]}>{LEGAL_STATUS_NOTE}</Text>
          </View>
        )}

        <View style={[s.summary, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.summaryText, { color: colors.textPrimary }]}>{doc.summary}</Text>
        </View>

        {doc.sections.map(sec => (
          <View key={sec.heading} style={s.section}>
            <Text style={[s.heading, { color: colors.textPrimary }]} accessibilityRole="header">
              {sec.heading}
            </Text>
            {sec.paragraphs?.map((p, i) => (
              <Text key={`p${i}`} style={[s.body, { color: colors.textSecondary }]}>{p}</Text>
            ))}
            {sec.bullets?.map((b, i) => (
              <View key={`b${i}`} style={s.bulletRow}>
                <View style={[s.bulletDot, { backgroundColor: colors.primary }]} />
                <Text style={[s.body, s.bulletText, { color: colors.textSecondary }]}>{b}</Text>
              </View>
            ))}
            {sec.after?.map((p, i) => (
              <Text key={`a${i}`} style={[s.body, { color: colors.textSecondary }]}>{p}</Text>
            ))}
          </View>
        ))}

        {footer}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { paddingHorizontal: 20, paddingTop: 20 },
  column:   { width: '100%', maxWidth: 720, alignSelf: 'center' },
  title:    { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  meta:     { fontSize: 12, marginTop: 6, marginBottom: 14 },
  draft:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  draftText:{ flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  summary:  { borderRadius: 14, padding: 14, marginBottom: 8 },
  summaryText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  section:  { marginTop: 18, gap: 8 },
  heading:  { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body:     { fontSize: 15, lineHeight: 23, ...(Platform.OS === 'web' ? ({ userSelect: 'text' } as any) : {}) },
  bulletRow:{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot:{ width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  bulletText: { flex: 1 },
});
