import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Share, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../state/ThemeContext';
import { Icon } from '../../../components/ui/Icon';
import { aceptarInvitacion, crearInvitacion } from '../services/SharedSpaceService';
import type { SharedSpace, SpaceInvitation } from '../types';

// ─── Pantalla: mostrar código de invitación generado ─────────────────────────

interface MostrarCodigoProps {
  espacio: SharedSpace;
  invitacion: SpaceInvitation;
  onRegenerarCodigo: (inv: SpaceInvitation) => void;
  onIrAlEspacio: () => void;
}

export const MostrarCodigoInvitacion: React.FC<MostrarCodigoProps> = ({
  espacio, invitacion, onRegenerarCodigo, onIrAlEspacio,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [regenerando, setRegenerando] = useState(false);

  const compartir = () => {
    Share.share({
      message: `¡Únete a "${espacio.name}" en FinancyAI!\nUsa el código: ${invitacion.code}\n\nJuntos llevaremos las finanzas en orden 💰`,
      title: 'Invitación a espacio compartido',
    });
  };

  const regenerar = async () => {
    try {
      setRegenerando(true);
      const nueva = await crearInvitacion(espacio.id);
      onRegenerarCodigo(nueva);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo regenerar el código');
    } finally {
      setRegenerando(false);
    }
  };

  const s = makeStyles(colors);
  const expira = new Date(invitacion.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Text style={s.titulo}>¡Espacio creado! 🎉</Text>
      <Text style={s.subtitulo}>
        Comparte este código con tu pareja para que se una a{' '}
        <Text style={{ fontWeight: '700', color: colors.primary }}>{espacio.name}</Text>
      </Text>

      {/* Código */}
      <View style={[s.codigoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Text style={[s.codigoLabel, { color: colors.textTertiary }]}>CÓDIGO DE INVITACIÓN</Text>
        <Text style={[s.codigo, { color: colors.primary }]}>{invitacion.code}</Text>
        <Text style={[s.expira, { color: colors.textSecondary }]}>Válido hasta el {expira}</Text>
      </View>

      <TouchableOpacity style={[s.btnCompartir, { backgroundColor: colors.primary }]} onPress={compartir} activeOpacity={0.8}>
        <Icon name="share-2" size={18} color="#fff" />
        <Text style={s.btnTexto}>Compartir código</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btnSecundario, { borderColor: colors.border }]} onPress={regenerar} disabled={regenerando} activeOpacity={0.7}>
        {regenerando
          ? <ActivityIndicator size="small" color={colors.textSecondary} />
          : <Text style={[s.btnSecTexto, { color: colors.textSecondary }]}>Generar nuevo código</Text>
        }
      </TouchableOpacity>

      {/* Badge privacidad */}
      <View style={[s.privacyBadge, { backgroundColor: colors.aiLight }]}>
        <Icon name="shield" size={14} color={colors.ai} />
        <Text style={[s.privacyText, { color: colors.aiText }]}>
          Solo tú y tu pareja verán los gastos compartidos
        </Text>
      </View>

      <TouchableOpacity style={[s.btnIr, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onIrAlEspacio} activeOpacity={0.8}>
        <Text style={[s.btnIrTexto, { color: colors.primary }]}>Ver el espacio compartido →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Pantalla: ingresar código para unirse ────────────────────────────────────

interface AceptarProps {
  onUnido: (espacio: SharedSpace) => void;
  onCancelar: () => void;
}

export const AceptarInvitacionScreen: React.FC<AceptarProps> = ({ onUnido, onCancelar }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleAceptar = async () => {
    const cod = codigo.trim().toUpperCase();
    if (cod.length < 6) {
      Alert.alert('Código inválido', 'El código debe tener al menos 6 caracteres.');
      return;
    }
    try {
      setCargando(true);
      const espacio = await aceptarInvitacion(cod);
      onUnido(espacio);
    } catch (e: any) {
      Alert.alert('No se pudo unir', e.message ?? 'Verifica el código e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onCancelar} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.titulo}>Unirse a un espacio</Text>
      </View>

      <View style={[s.iconoContainer, { backgroundColor: colors.primaryLight }]}>
        <Text style={s.iconoEmoji}>🔗</Text>
      </View>

      <Text style={s.subtitulo}>
        Ingresa el código que te compartió tu pareja para unirte al espacio compartido.
      </Text>

      <Text style={[s.label, { color: colors.textTertiary }]}>CÓDIGO DE INVITACIÓN</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
        placeholder="Ej: ABCD1234"
        placeholderTextColor={colors.textTertiary}
        value={codigo}
        onChangeText={t => setCodigo(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={12}
        returnKeyType="done"
        onSubmitEditing={handleAceptar}
      />

      <TouchableOpacity
        style={[s.btnPrimario, { backgroundColor: colors.primary, opacity: cargando ? 0.7 : 1 }]}
        onPress={handleAceptar}
        disabled={cargando}
        activeOpacity={0.8}
      >
        {cargando
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnTexto}>Unirme al espacio</Text>
        }
      </TouchableOpacity>

      <View style={[s.privacyBadge, { backgroundColor: colors.aiLight }]}>
        <Icon name="lock" size={14} color={colors.ai} />
        <Text style={[s.privacyText, { color: colors.aiText }]}>
          Tu historial financiero personal sigue siendo privado
        </Text>
      </View>
    </ScrollView>
  );
};

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  backBtn: { padding: 8, marginRight: 8 },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  subtitulo: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  iconoContainer: {
    width: 80, height: 80, borderRadius: 40,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  iconoEmoji: { fontSize: 40 },
  codigoCard: {
    borderWidth: 2, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
  },
  codigoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  codigo: { fontSize: 36, fontWeight: '800', letterSpacing: 6, marginBottom: 6 },
  expira: { fontSize: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, fontWeight: '700', letterSpacing: 4, textAlign: 'center', marginBottom: 24,
  },
  btnCompartir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16, marginBottom: 12,
  },
  btnSecundario: {
    borderWidth: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  btnSecTexto: { fontSize: 14 },
  btnPrimario: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  btnTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    alignSelf: 'center', marginBottom: 20,
  },
  privacyText: { fontSize: 13, fontWeight: '500' },
  btnIr: {
    borderWidth: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnIrTexto: { fontSize: 15, fontWeight: '600' },
});
