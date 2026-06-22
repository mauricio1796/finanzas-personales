import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../state/ThemeContext';
import { Icon } from '../../../components/ui/Icon';
import { crearEspacio, crearInvitacion } from '../services/SharedSpaceService';
import type { SharedSpace, SpaceInvitation } from '../types';

interface Props {
  onEspacioCreado: (espacio: SharedSpace, invitacion: SpaceInvitation) => void;
  onCancelar: () => void;
}

export const CrearEspacioScreen: React.FC<Props> = ({ onEspacioCreado, onCancelar }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleCrear = async () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      Alert.alert('Campo requerido', 'Escribe un nombre para el espacio compartido.');
      return;
    }
    try {
      setCargando(true);
      const espacio = await crearEspacio(nombreLimpio);
      const invitacion = await crearInvitacion(espacio.id);
      onEspacioCreado(espacio, invitacion);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear el espacio. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[s.container, { paddingTop: insets.top + 16 }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onCancelar} style={s.backBtn}>
            <Icon name="arrow-left" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.titulo}>Crear espacio compartido</Text>
        </View>

        {/* Ícono decorativo */}
        <View style={[s.iconoContainer, { backgroundColor: colors.primaryLight }]}>
          <Text style={s.iconoEmoji}>💑</Text>
        </View>

        <Text style={s.subtitulo}>
          Un espacio donde tú y tu pareja registran gastos juntos,
          ven el balance y llevan un presupuesto común.
        </Text>

        {/* Badge de privacidad */}
        <View style={[s.privacyBadge, { backgroundColor: colors.aiLight }]}>
          <Icon name="lock" size={14} color={colors.ai} />
          <Text style={[s.privacyText, { color: colors.aiText }]}>
            Tus finanzas personales siguen siendo privadas
          </Text>
        </View>

        {/* Formulario */}
        <Text style={[s.label, { color: colors.textTertiary }]}>NOMBRE DEL ESPACIO</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="Ej: Nuestras finanzas, Casa familiar..."
          placeholderTextColor={colors.textTertiary}
          value={nombre}
          onChangeText={setNombre}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={handleCrear}
        />

        <TouchableOpacity
          style={[s.btnPrimario, { backgroundColor: colors.primary, opacity: cargando ? 0.7 : 1 }]}
          onPress={handleCrear}
          disabled={cargando}
          activeOpacity={0.8}
        >
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnTexto}>Crear e invitar</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  backBtn: { padding: 8, marginRight: 8 },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  iconoContainer: {
    width: 80, height: 80, borderRadius: 40,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconoEmoji: { fontSize: 40 },
  subtitulo: {
    fontSize: 15, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 20,
  },
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    marginBottom: 28, alignSelf: 'center',
  },
  privacyText: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 24,
  },
  btnPrimario: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
