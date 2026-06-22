import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../state/ThemeContext';
import { Icon } from '../../../components/ui/Icon';
import { obtenerMiEspacio } from '../services/SharedSpaceService';
import { CrearEspacioScreen } from './CrearEspacioScreen';
import { AceptarInvitacionScreen, MostrarCodigoInvitacion } from './InvitacionScreen';
import { EspacioCompartidoScreen } from './EspacioCompartidoScreen';
import type { SharedSpace, SpaceInvitation } from '../types';

type Vista = 'cargando' | 'bienvenida' | 'crear' | 'unirse' | 'codigoGenerado' | 'espacio';

export const SharedFinancesEntryScreen: React.FC<{ onVolver: () => void }> = ({ onVolver }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Vista>('cargando');
  const [espacio, setEspacio]         = useState<SharedSpace | null>(null);
  const [invitacion, setInvitacion]   = useState<SpaceInvitation | null>(null);

  useEffect(() => {
    obtenerMiEspacio()
      .then(esp => {
        if (esp) { setEspacio(esp); setVista('espacio'); }
        else setVista('bienvenida');
      })
      .catch(() => setVista('bienvenida'));
  }, []);

  const s = makeStyles(colors);

  if (vista === 'cargando') {
    return (
      <View style={[s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (vista === 'espacio') {
    return <EspacioCompartidoScreen onVolver={onVolver} />;
  }

  if (vista === 'crear') {
    return (
      <CrearEspacioScreen
        onEspacioCreado={(esp, inv) => {
          setEspacio(esp);
          setInvitacion(inv);
          setVista('codigoGenerado');
        }}
        onCancelar={() => setVista('bienvenida')}
      />
    );
  }

  if (vista === 'unirse') {
    return (
      <AceptarInvitacionScreen
        onUnido={esp => { setEspacio(esp); setVista('espacio'); }}
        onCancelar={() => setVista('bienvenida')}
      />
    );
  }

  if (vista === 'codigoGenerado' && espacio && invitacion) {
    return (
      <MostrarCodigoInvitacion
        espacio={espacio}
        invitacion={invitacion}
        onRegenerarCodigo={setInvitacion}
        onIrAlEspacio={() => setVista('espacio')}
      />
    );
  }

  // ─── Vista: bienvenida (sin espacio aún) ─────────────────────────────────────
  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onVolver} style={s.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[s.titulo, { color: colors.textPrimary }]}>Finanzas compartidas</Text>
      </View>

      <Text style={s.heroEmoji}>💑</Text>
      <Text style={[s.heroTitulo, { color: colors.textPrimary }]}>Gestiona gastos con tu pareja</Text>
      <Text style={[s.heroDesc, { color: colors.textSecondary }]}>
        Registren gastos juntos, divídanlos 50/50 automáticamente y siempre sepan quién debe a quién.
      </Text>

      {/* Features */}
      {[
        { icono: 'divide', texto: 'División automática 50/50 de cada gasto' },
        { icono: 'bar-chart-2', texto: 'Balance en tiempo real: quién debe y cuánto' },
        { icono: 'lock', texto: 'Tus finanzas personales siguen siendo 100% privadas' },
        { icono: 'zap', texto: 'Finn te da consejos del espacio compartido' },
      ].map(f => (
        <View key={f.icono} style={[s.featureRow, { backgroundColor: colors.card }]}>
          <View style={[s.featureIcono, { backgroundColor: colors.primaryLight }]}>
            <Icon name={f.icono as any} size={16} color={colors.primary} />
          </View>
          <Text style={[s.featureTxt, { color: colors.textPrimary }]}>{f.texto}</Text>
        </View>
      ))}

      <View style={s.botones}>
        <TouchableOpacity
          style={[s.btnPrimario, { backgroundColor: colors.primary }]}
          onPress={() => setVista('crear')}
          activeOpacity={0.85}
        >
          <Icon name="plus-circle" size={18} color="#fff" />
          <Text style={s.btnPrimarioTxt}>Crear espacio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnSecundario, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => setVista('unirse')}
          activeOpacity={0.85}
        >
          <Icon name="link" size={18} color={colors.primary} />
          <Text style={[s.btnSecundarioTxt, { color: colors.primary }]}>Tengo un código</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  backBtn: { padding: 8, marginRight: 8 },
  titulo: { fontSize: 20, fontWeight: '700' },
  heroEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  heroTitulo: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  heroDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  featureIcono: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureTxt: { flex: 1, fontSize: 14, lineHeight: 20 },
  botones: { marginTop: 28, gap: 12 },
  btnPrimario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16,
  },
  btnPrimarioTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16, borderWidth: 1,
  },
  btnSecundarioTxt: { fontSize: 16, fontWeight: '600' },
});
