/**
 * ConsentGate — pide las autorizaciones obligatorias a quien ya tiene sesión
 * pero no las ha otorgado en la versión vigente (cuentas creadas antes de este
 * flujo o documentos actualizados). Las autorizaciones opcionales (IA y
 * comunicaciones comerciales) se ofrecen sin marcar y no bloquean.
 */
import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { ConsentCheckbox } from './ConsentCheckbox';
import { LegalModal } from './LegalModal';
import { consentService } from '../../services/ConsentService';
import type { LegalDocId } from '../../legal';

interface Props {
  visible: boolean;
  userId: string;
  /** true si el usuario ya aceptó una versión anterior (texto de "actualizamos"). */
  isUpdate?: boolean;
  onAccepted: () => void;
  onSignOut: () => void;
}

export function ConsentGate({ visible, userId, isUpdate, onAccepted, onSignOut }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [ai, setAi] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [doc, setDoc] = useState<LegalDocId | null>(null);
  const [saving, setSaving] = useState(false);

  const canContinue = privacy && terms && age && !saving;

  const aceptar = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      await consentService.record([
        { type: 'privacy', granted: true },
        { type: 'terms', granted: true },
        { type: 'age_confirmation', granted: true },
        { type: 'ai_processing', granted: ai },
        { type: 'marketing', granted: marketing },
      ], 'consent_gate', userId);
      onAccepted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={[s.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <Icon name="shield" size={26} color={colors.primary} />
          </View>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {isUpdate ? 'Actualizamos nuestros documentos' : 'Tu privacidad, en tus manos'}
          </Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>
            Para seguir usando FinancyAI necesitamos tu autorización para tratar tus datos y que aceptes los términos.
            Cada autorización es independiente y puedes cambiar las opcionales cuando quieras en Perfil › Privacidad y mis datos.
          </Text>

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.group, { color: colors.textTertiary }]}>OBLIGATORIAS</Text>
            <ConsentCheckbox
              checked={privacy} onToggle={() => setPrivacy(v => !v)} required
              label="Autorizo el tratamiento de mis datos personales conforme a la"
              linkLabel="Política de Tratamiento de Datos" onLinkPress={() => setDoc('privacy')}
              labelAfter="."
              testID="gate-privacy"
            />
            <ConsentCheckbox
              checked={terms} onToggle={() => setTerms(v => !v)} required
              label="Acepto los" linkLabel="Términos y Condiciones" onLinkPress={() => setDoc('terms')}
              labelAfter="."
              testID="gate-terms"
            />
            <ConsentCheckbox
              checked={age} onToggle={() => setAge(v => !v)} required
              label="Declaro que soy mayor de 18 años."
              testID="gate-age"
            />

            <Text style={[s.group, { color: colors.textTertiary, marginTop: 18 }]}>OPCIONALES</Text>
            <ConsentCheckbox
              checked={ai} onToggle={() => setAi(v => !v)}
              label="Autorizo que mi contexto financiero minimizado se procese con el proveedor de IA de Finn, como explica el"
              linkLabel="Aviso de IA" onLinkPress={() => setDoc('ai')}
              labelAfter=". Sin esto, Finn funciona en modo básico."
              testID="gate-ai"
            />
            <ConsentCheckbox
              checked={marketing} onToggle={() => setMarketing(v => !v)}
              label="Quiero recibir novedades y comunicaciones comerciales de FinancyAI."
              testID="gate-marketing"
            />
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={aceptar}
          disabled={!canContinue}
          style={[s.cta, { backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.45 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          testID="gate-accept"
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaText}>Aceptar y continuar</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onSignOut} style={s.secondary} accessibilityRole="button">
          <Text style={[s.secondaryText, { color: colors.textTertiary }]}>No acepto · cerrar sesión</Text>
        </TouchableOpacity>
      </View>
      <LegalModal docId={doc} onClose={() => setDoc(null)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 20 },
  scroll:   { width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  title:    { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  sub:      { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  card:     { borderWidth: 1, borderRadius: 18, padding: 16 },
  group:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  cta:      { borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  ctaText:  { color: '#FFF', fontSize: 16, fontWeight: '800' },
  secondary:{ alignSelf: 'center', paddingVertical: 12 },
  secondaryText: { fontSize: 13, fontWeight: '500' },
});
