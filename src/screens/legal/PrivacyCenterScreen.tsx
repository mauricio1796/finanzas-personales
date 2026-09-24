/**
 * Privacidad y mis datos — centro de derechos del titular.
 *
 * Perfil › Privacidad y mis datos:
 *   · Autorizaciones (IA y comunicaciones comerciales se activan/revocan aquí)
 *   · Descargar mis datos (JSON)
 *   · Ejercer mis derechos (consulta, corrección, supresión, revocatoria, reclamo)
 *   · Documentos legales y contacto
 *   · Eliminar cuenta
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Switch,
  Alert, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { useFinance } from '../../state/FinanceContext';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Icon, type FeatherName } from '../../components/ui/Icon';
import { consentService, type ConsentState } from '../../services/ConsentService';
import {
  exportarMisDatos, compartirArchivoJSON, enviarSolicitud, listarSolicitudes,
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL,
  type PrivacyRequest, type PrivacyRequestType,
} from '../../services/PrivacyService';
import {
  LEGAL_SCREEN, PRIVACY_CONTACT_EMAIL, SIC_URL, LEGAL_ENTITY_INCOMPLETE,
  type LegalDocId,
} from '../../legal';

interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

const TIPOS: PrivacyRequestType[] = ['consulta', 'actualizacion', 'rectificacion', 'supresion', 'revocatoria', 'reclamo'];

const DOCS: { id: LegalDocId; label: string; icon: FeatherName }[] = [
  { id: 'privacy', label: 'Política de Tratamiento de Datos', icon: 'shield' },
  { id: 'terms',   label: 'Términos y Condiciones',          icon: 'file-text' },
  { id: 'ai',      label: 'Aviso sobre Finn e IA',            icon: 'cpu' },
  { id: 'rights',  label: 'Mis derechos y cómo ejercerlos',   icon: 'help-circle' },
  { id: 'cookies', label: 'Cookies y tecnologías similares',  icon: 'globe' },
];

function fecha(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

interface RowProps {
  icon: FeatherName;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

function Row({ icon, label, sub, onPress, danger, colors }: RowProps) {
  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: colors.card, borderColor: danger ? colors.danger + '40' : colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
    >
      <View style={[s.rowIcon, { backgroundColor: danger ? colors.dangerLight : colors.primaryLight }]}>
        <Icon name={icon} size={16} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: danger ? colors.danger : colors.textPrimary }]}>{label}</Text>
        {sub ? <Text style={[s.rowSub, { color: colors.textTertiary }]}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-right" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export function PrivacyCenterScreen({ onBack, onNavigate }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const { user } = finance;

  const [consents, setConsents] = useState<ConsentState>({});
  const [exporting, setExporting] = useState(false);
  const [tipo, setTipo] = useState<PrivacyRequestType>('consulta');
  const [detalle, setDetalle] = useState('');
  const [sending, setSending] = useState(false);
  const [solicitudes, setSolicitudes] = useState<PrivacyRequest[]>([]);

  useEffect(() => {
    consentService.getLocal().then(setConsents);
    consentService.syncFromServer().then(setConsents).catch(() => {});
    listarSolicitudes().then(setSolicitudes);
    return consentService.subscribe(setConsents);
  }, []);

  const cambiarOpcional = async (type: 'ai_processing' | 'marketing', value: boolean) => {
    await consentService.record([{ type, granted: value }], 'privacy_center', user?.id);
  };

  const confirmarIA = (value: boolean) => {
    if (!value) { cambiarOpcional('ai_processing', false); return; }
    const msg = 'Finn enviará al proveedor de IA un resumen de tu contexto financiero (sin tu nombre, correo ni identificadores) para responderte. También se habilitan la voz y el escaneo de recibos.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${msg}\n\n¿Activar procesamiento con IA?`)) cambiarOpcional('ai_processing', true);
      return;
    }
    Alert.alert('Activar procesamiento con IA', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Activar', onPress: () => cambiarOpcional('ai_processing', true) },
    ]);
  };

  const exportar = async () => {
    setExporting(true);
    try {
      const json = await exportarMisDatos({
        usuario: user ? { id: user.id, email: user.email, nombre: user.name } : null,
        perfil: finance.profile,
        meta_principal: finance.goal,
        nivel: finance.userLevel,
        premium: finance.premium,
        categorias: finance.categories,
        transacciones: finance.transactions,
        metas: finance.metas,
        deudas: finance.deudas,
        recurrentes: finance.recurrentes,
        lecciones_completadas: finance.leccionesCompletadas,
        retos_completados: finance.retosCompletados,
      });
      await compartirArchivoJSON(json);
    } catch {
      Alert.alert('Descargar mis datos', 'No fue posible generar el archivo. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const enviar = async () => {
    if (!user?.id) {
      Alert.alert('Inicia sesión', `Para enviar una solicitud desde la app necesitas iniciar sesión. También puedes escribir a ${PRIVACY_CONTACT_EMAIL}.`);
      return;
    }
    setSending(true);
    const r = await enviarSolicitud(user.id, tipo, detalle);
    setSending(false);
    if (r.ok) {
      setDetalle('');
      setSolicitudes(await listarSolicitudes());
      const plazo = tipo === 'consulta' ? '10' : '15';
      Alert.alert('Solicitud recibida', `Te responderemos al correo de tu cuenta en un máximo de ${plazo} días hábiles, según la Ley 1581 de 2012.`);
    } else {
      Alert.alert('No se pudo enviar', r.error ?? 'Intenta de nuevo.');
    }
  };

  const abrirCorreo = () => {
    if (LEGAL_ENTITY_INCOMPLETE) {
      Alert.alert('Canal de contacto', 'El correo de privacidad aún no está configurado en esta versión. Usa el formulario de solicitudes.');
      return;
    }
    Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent('Solicitud de privacidad — FinancyAI')}`).catch(() => {});
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Privacidad y mis datos" onBack={onBack} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={s.column}>
          <Text style={[s.intro, { color: colors.textSecondary }]}>
            Tú decides sobre tus datos. Desde aquí puedes ver tus autorizaciones, descargar tu información, ejercer tus derechos o eliminar tu cuenta.
          </Text>

          {/* ── Autorizaciones ── */}
          <Text style={[s.section, { color: colors.textTertiary }]}>TUS AUTORIZACIONES</Text>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {([
              ['privacy', 'Tratamiento de datos personales'],
              ['terms', 'Términos y Condiciones'],
              ['age_confirmation', 'Mayoría de edad'],
            ] as const).map(([k, label]) => (
              <View key={k} style={[s.consentRow, { borderBottomColor: colors.borderSubtle }]}>
                <Icon name={consents[k]?.granted ? 'check-circle' : 'circle'} size={16} color={consents[k]?.granted ? colors.income : colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.consentLabel, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[s.consentMeta, { color: colors.textTertiary }]}>
                    {consents[k]?.granted ? `Aceptado · v${consents[k]?.version} · ${fecha(consents[k]?.at)}` : 'Pendiente'}
                  </Text>
                </View>
                <Text style={[s.badge, { color: colors.textTertiary }]}>Obligatoria</Text>
              </View>
            ))}

            <View style={[s.consentRow, { borderBottomColor: colors.borderSubtle }]}>
              <Icon name="cpu" size={16} color={colors.ai} />
              <View style={{ flex: 1 }}>
                <Text style={[s.consentLabel, { color: colors.textPrimary }]}>Procesamiento con IA (Finn)</Text>
                <Text style={[s.consentMeta, { color: colors.textTertiary }]}>
                  Envía tu contexto financiero minimizado al proveedor de IA. Sin esto, Finn funciona en modo básico.
                </Text>
              </View>
              <Switch
                value={consents.ai_processing?.granted === true}
                onValueChange={confirmarIA}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel="Procesamiento con IA"
                testID="privacy-ai-switch"
              />
            </View>
            <View style={[s.consentRow, { borderBottomWidth: 0 }]}>
              <Icon name="mail" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.consentLabel, { color: colors.textPrimary }]}>Comunicaciones comerciales</Text>
                <Text style={[s.consentMeta, { color: colors.textTertiary }]}>Novedades y ofertas de FinancyAI.</Text>
              </View>
              <Switch
                value={consents.marketing?.granted === true}
                onValueChange={v => cambiarOpcional('marketing', v)}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel="Comunicaciones comerciales"
              />
            </View>
          </View>
          <Text style={[s.note, { color: colors.textTertiary }]}>
            Las autorizaciones obligatorias son necesarias para prestar el servicio. Para revocarlas puedes eliminar tu cuenta o enviar una solicitud de revocatoria.
          </Text>

          {/* ── Acciones ── */}
          <Text style={[s.section, { color: colors.textTertiary }]}>TUS DATOS</Text>
          <TouchableOpacity
            style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={exportar}
            disabled={exporting}
            activeOpacity={0.75}
            accessibilityRole="button"
            testID="privacy-export"
          >
            <View style={[s.rowIcon, { backgroundColor: colors.primaryLight }]}>
              {exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="download" size={16} color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: colors.textPrimary }]}>Descargar mis datos</Text>
              <Text style={[s.rowSub, { color: colors.textTertiary }]}>Archivo JSON con tu cuenta, movimientos, metas y autorizaciones</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* ── Mis derechos ── */}
          <Text style={[s.section, { color: colors.textTertiary }]}>EJERCER MIS DERECHOS</Text>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.chips}>
              {TIPOS.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTipo(t)}
                  style={[s.chip, { borderColor: tipo === t ? colors.primary : colors.border, backgroundColor: tipo === t ? colors.primaryLight : 'transparent' }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: tipo === t }}
                >
                  <Text style={[s.chipText, { color: tipo === t ? colors.primary : colors.textSecondary }]}>{REQUEST_TYPE_LABEL[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Cuéntanos qué necesitas (opcional). No incluyas contraseñas ni números de tarjeta."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={2000}
              style={[s.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              accessibilityLabel="Detalle de la solicitud"
            />
            <TouchableOpacity
              onPress={enviar}
              disabled={sending}
              style={[s.cta, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              {sending ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaText}>Enviar solicitud</Text>}
            </TouchableOpacity>
            <Text style={[s.note, { color: colors.textTertiary, marginTop: 10 }]}>
              Consultas: respuesta en máximo 10 días hábiles. Reclamos: máximo 15 días hábiles (Ley 1581 de 2012).
            </Text>

            {solicitudes.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={[s.consentLabel, { color: colors.textPrimary }]}>Tus solicitudes</Text>
                {solicitudes.map(r => (
                  <View key={r.id} style={[s.reqRow, { borderColor: colors.borderSubtle }]}>
                    <Text style={[s.consentMeta, { color: colors.textSecondary, flex: 1 }]}>
                      {REQUEST_TYPE_LABEL[r.request_type]} · {fecha(r.created_at)}
                    </Text>
                    <Text style={[s.badge, { color: r.status === 'respondida' || r.status === 'cerrada' ? colors.income : colors.warningText }]}>
                      {REQUEST_STATUS_LABEL[r.status]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Row colors={colors} icon="mail" label="Escribir al canal de privacidad" sub={PRIVACY_CONTACT_EMAIL} onPress={abrirCorreo} />
          <Row colors={colors} icon="external-link" label="Superintendencia de Industria y Comercio" sub="Autoridad de protección de datos y del consumidor" onPress={() => Linking.openURL(SIC_URL).catch(() => {})} />

          {/* ── Documentos ── */}
          <Text style={[s.section, { color: colors.textTertiary }]}>DOCUMENTOS</Text>
          {DOCS.map(d => (
            <Row colors={colors} key={d.id} icon={d.icon} label={d.label} onPress={() => onNavigate(LEGAL_SCREEN[d.id])} />
          ))}

          {/* ── Eliminar ── */}
          <Text style={[s.section, { color: colors.textTertiary }]}>CUENTA</Text>
          <Row colors={colors} icon="user-x" label="Eliminar cuenta" sub="Borra tu cuenta y tus datos de forma definitiva" onPress={() => onNavigate('eliminar-cuenta')} danger />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { padding: 16 },
  column:  { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 10 },
  intro:   { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 14 },
  card:    { borderWidth: 1, borderRadius: 16, padding: 14 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  consentLabel: { fontSize: 14, fontWeight: '600' },
  consentMeta:  { fontSize: 12, lineHeight: 17, marginTop: 2 },
  badge:   { fontSize: 11, fontWeight: '600' },
  note:    { fontSize: 12, lineHeight: 17 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTitle:{ fontSize: 14, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 2 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:{ fontSize: 12, fontWeight: '600' },
  input:   { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90, marginTop: 12, textAlignVertical: 'top', fontSize: 14 },
  cta:     { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  reqRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
});
