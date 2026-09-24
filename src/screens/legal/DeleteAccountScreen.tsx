/**
 * Eliminar cuenta — Perfil › Privacidad y mis datos › Eliminar cuenta.
 *
 * Flujo: advertencia → consecuencias → confirmación escrita ("ELIMINAR") →
 * reautenticación con PIN (si el dispositivo tiene uno) → eliminación en el
 * servidor → cierre de sesión y limpieza local → mensaje final.
 *
 * Requisito de tiendas: Apple (Guideline 5.1.1(v)) y Google Play (política de
 * eliminación de cuentas) exigen poder iniciar la eliminación desde la app.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { useFinance } from '../../state/FinanceContext';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Icon } from '../../components/ui/Icon';
import { eliminarCuenta } from '../../services/PrivacyService';
import { hasPin, verifyPin } from '../../services/PinService';
import { PRIVACY_CONTACT_EMAIL } from '../../legal';

interface Props {
  onBack: () => void;
  onExportFirst: () => void;
  /** Se llama tras eliminar la cuenta para devolver la app al inicio. */
  onDeleted: () => void;
}

const PALABRA = 'ELIMINAR';

export function DeleteAccountScreen({ onBack, onExportFirst, onDeleted }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, premium } = useFinance();

  const [confirmText, setConfirmText] = useState('');
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<{ pagosConservados: boolean } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') hasPin().then(setNeedsPin).catch(() => setNeedsPin(false));
  }, []);

  const puedeEliminar = confirmText.trim().toUpperCase() === PALABRA && (!needsPin || pin.length >= 4) && !working && !!user;

  const eliminar = async () => {
    if (!puedeEliminar) return;
    setError(null);
    setWorking(true);
    try {
      if (needsPin) {
        const r = await verifyPin(pin);
        if (!r.ok) {
          setError(r.bloqueado
            ? `Demasiados intentos. Espera ${r.segundosRestantes} segundos.`
            : 'PIN incorrecto.');
          setPin('');
          return;
        }
      }
      const r = await eliminarCuenta();
      if (!r.ok) { setError(r.error ?? 'No se pudo eliminar la cuenta.'); return; }
      setDone({ pagosConservados: !!r.pagosConservados });
    } finally {
      setWorking(false);
    }
  };

  if (done) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
        <View style={[s.bigIcon, { backgroundColor: colors.incomeLight }]}>
          <Icon name="check" size={30} color={colors.income} />
        </View>
        <Text style={[s.doneTitle, { color: colors.textPrimary }]}>Tu cuenta fue eliminada</Text>
        <Text style={[s.doneBody, { color: colors.textSecondary }]}>
          Borramos tu cuenta y tus datos de nuestros servidores y de este dispositivo.
          {done.pagosConservados
            ? ' Conservamos, sin vínculo con tu cuenta, el soporte mínimo de tus pagos de Premium por el tiempo que exige la ley.'
            : ''}
          {'\n\n'}Gracias por haber usado FinancyAI.
        </Text>
        <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} onPress={onDeleted} accessibilityRole="button">
          <Text style={s.ctaText}>Finalizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Eliminar cuenta" onBack={onBack} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={s.column}>
          <View style={[s.warn, { backgroundColor: colors.dangerLight, borderColor: colors.danger + '55' }]}>
            <Icon name="alert-triangle" size={20} color={colors.danger} />
            <Text style={[s.warnText, { color: colors.danger }]}>
              Esta acción es definitiva y no se puede deshacer.
            </Text>
          </View>

          <Text style={[s.h, { color: colors.textPrimary }]}>Qué se elimina</Text>
          {[
            'Tu cuenta de acceso y tu perfil.',
            'Todos tus ingresos, gastos, categorías, presupuestos, metas, deudas y pagos recurrentes.',
            'La memoria de Finn, tus alertas, logros, nivel y preferencias.',
            'Tus autorizaciones y tus membresías en espacios compartidos.',
            'Los datos guardados en este teléfono.',
          ].map(t => (
            <View key={t} style={s.li}><Icon name="x" size={14} color={colors.danger} /><Text style={[s.liText, { color: colors.textSecondary }]}>{t}</Text></View>
          ))}

          <Text style={[s.h, { color: colors.textPrimary }]}>Ten en cuenta</Text>
          {[
            'Los espacios compartidos que tú creaste se eliminarán también para los demás miembros.',
            premium.isPremium
              ? 'Tienes Premium activo: el tiempo restante se pierde. La eliminación no genera reembolso, salvo lo previsto en la ley (retracto o reversión).'
              : 'Si compraste Premium antes, conservamos sin vínculo con tu cuenta el soporte mínimo del pago, como exige la ley.',
            `Si no puedes completar este proceso, escríbenos a ${PRIVACY_CONTACT_EMAIL}.`,
          ].map(t => (
            <View key={t} style={s.li}><Icon name="info" size={14} color={colors.textTertiary} /><Text style={[s.liText, { color: colors.textSecondary }]}>{t}</Text></View>
          ))}

          <TouchableOpacity onPress={onExportFirst} style={[s.export, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button">
            <Icon name="download" size={16} color={colors.primary} />
            <Text style={[s.exportText, { color: colors.primary }]}>Antes, descargar una copia de mis datos</Text>
          </TouchableOpacity>

          <Text style={[s.h, { color: colors.textPrimary }]}>Confirmación</Text>
          <Text style={[s.label, { color: colors.textSecondary }]}>Escribe {PALABRA} para confirmar</Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={PALABRA}
            placeholderTextColor={colors.textTertiary}
            style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            accessibilityLabel={`Escribe ${PALABRA} para confirmar`}
            testID="delete-confirm-input"
          />
          {needsPin && (
            <>
              <Text style={[s.label, { color: colors.textSecondary, marginTop: 12 }]}>Ingresa tu PIN</Text>
              <TextInput
                value={pin}
                onChangeText={t => setPin(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="••••"
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                accessibilityLabel="PIN"
              />
            </>
          )}

          {error && <Text style={[s.error, { color: colors.expense }]}>{error}</Text>}

          <TouchableOpacity
            onPress={eliminar}
            disabled={!puedeEliminar}
            style={[s.cta, { backgroundColor: colors.danger, opacity: puedeEliminar ? 1 : 0.4 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !puedeEliminar }}
            testID="delete-account-btn"
          >
            {working ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaText}>Eliminar mi cuenta definitivamente</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} style={s.cancel} accessibilityRole="button">
            <Text style={[s.cancelText, { color: colors.textTertiary }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { alignItems: 'center', paddingHorizontal: 24 },
  scroll:  { padding: 16 },
  column:  { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 8 },
  warn:    { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14 },
  warnText:{ flex: 1, fontSize: 14, fontWeight: '700' },
  h:       { fontSize: 15, fontWeight: '700', marginTop: 14 },
  li:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  liText:  { flex: 1, fontSize: 14, lineHeight: 21 },
  export:  { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  exportText: { fontSize: 14, fontWeight: '600' },
  label:   { fontSize: 13 },
  input:   { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, letterSpacing: 1 },
  error:   { fontSize: 13, fontWeight: '600', marginTop: 8 },
  cta:     { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16, width: '100%', maxWidth: 620 },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  cancel:  { alignSelf: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, fontWeight: '500' },
  bigIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  doneBody:  { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, maxWidth: 420 },
});
