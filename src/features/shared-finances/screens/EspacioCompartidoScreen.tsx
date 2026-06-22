import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../state/ThemeContext';
import { Icon } from '../../../components/ui/Icon';
import {
  obtenerMiEspacio,
  obtenerMiembros,
  calcularBalances,
  crearInvitacion,
} from '../services/SharedSpaceService';
import { obtenerGastosCompartidos } from '../services/SharedExpenseService';
import { RegistrarGastoCompartidoScreen } from './RegistrarGastoCompartidoScreen';
import { MostrarCodigoInvitacion } from './InvitacionScreen';
import type { SharedSpace, SpaceMember, MemberBalance, SharedExpense, SpaceInvitation } from '../types';

// ─── Formato moneda ────────────────────────────────────────────────────────────
function fmtCOP(n: number) {
  return '$' + Math.round(Math.abs(n)).toLocaleString('es-CO');
}

interface Props {
  onVolver: () => void;
}

export const EspacioCompartidoScreen: React.FC<Props> = ({ onVolver }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [espacio, setEspacio]         = useState<SharedSpace | null>(null);
  const [miembros, setMiembros]       = useState<SpaceMember[]>([]);
  const [balances, setBalances]       = useState<MemberBalance[]>([]);
  const [gastos, setGastos]           = useState<SharedExpense[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalGasto, setModalGasto]   = useState(false);
  const [modalInv, setModalInv]       = useState(false);
  const [invActual, setInvActual]     = useState<SpaceInvitation | null>(null);

  const cargarDatos = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const esp = await obtenerMiEspacio();
      if (!esp) { setEspacio(null); return; }
      setEspacio(esp);
      const [m, b, g] = await Promise.all([
        obtenerMiembros(esp.id),
        calcularBalances(esp.id),
        obtenerGastosCompartidos(esp.id),
      ]);
      setMiembros(m);
      setBalances(b);
      setGastos(g);
    } catch (e: any) {
      if (!silencioso) Alert.alert('Error', e.message ?? 'No se pudieron cargar los datos');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleInvitar = async () => {
    if (!espacio) return;
    try {
      const inv = await crearInvitacion(espacio.id);
      setInvActual(inv);
      setModalInv(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const s = makeStyles(colors);

  if (cargando) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.cargandoTxt, { color: colors.textSecondary }]}>Cargando espacio compartido…</Text>
      </View>
    );
  }

  if (!espacio) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>💑</Text>
        <Text style={[s.emptyTitulo, { color: colors.textPrimary }]}>Sin espacio compartido</Text>
        <Text style={[s.emptySubtitulo, { color: colors.textSecondary }]}>
          Crea uno desde el botón de inicio o acepta una invitación.
        </Text>
        <TouchableOpacity onPress={onVolver} style={[s.btnVolver, { borderColor: colors.border }]}>
          <Text style={[{ color: colors.primary, fontWeight: '600' }]}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Balance neto entre dos miembros (pareja)
  const deudaNeta = balances.length === 2
    ? balances[0].net > 1
      ? { acreedor: balances[0].displayName, deudor: balances[1].displayName, monto: Math.abs(balances[0].net) }
      : balances[1].net > 1
        ? { acreedor: balances[1].displayName, deudor: balances[0].displayName, monto: Math.abs(balances[1].net) }
        : null
    : null;

  const totalMes = gastos
    .filter(g => g.date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, g) => s + g.amount, 0);

  return (
    <>
      <ScrollView
        style={[s.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargarDatos(true); }}
            tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={[s.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={onVolver} style={s.backBtn}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitulo}>{espacio.name}</Text>
            <Text style={s.headerSubtitulo}>
              {miembros.map(m => m.displayName).join(' & ')} · Espacio compartido
            </Text>
          </View>
          <TouchableOpacity onPress={handleInvitar} style={s.invBtn}>
            <Icon name="user-plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Badge privacidad */}
        <View style={[s.privacyBar, { backgroundColor: colors.aiLight }]}>
          <Icon name="shield" size={13} color={colors.ai} />
          <Text style={[s.privacyTxt, { color: colors.aiText }]}>
            Solo tú y tu pareja ven estos datos — tus finanzas personales son privadas
          </Text>
        </View>

        {/* Resumen del mes */}
        <View style={[s.card, { backgroundColor: colors.card }]}>
          <Text style={[s.cardLabel, { color: colors.textTertiary }]}>GASTO TOTAL ESTE MES</Text>
          <Text style={[s.totalMes, { color: colors.textPrimary }]}>{fmtCOP(totalMes)}</Text>
          <View style={s.miembrosRow}>
            {miembros.map(m => (
              <View key={m.userId} style={[s.miembroBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={s.miembroEmoji}>👤</Text>
                <Text style={[s.miembroNombre, { color: colors.primaryText }]}>{m.displayName}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Balance — quién debe a quién */}
        <Text style={[s.seccion, { color: colors.textTertiary }]}>BALANCE</Text>
        {deudaNeta ? (
          <View style={[s.card, { backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning }]}>
            <View style={s.balanceRow}>
              <Icon name="alert-circle" size={18} color={colors.warning} />
              <Text style={[s.balanceTxt, { color: colors.warningText }]}>
                <Text style={{ fontWeight: '700' }}>{deudaNeta.deudor}</Text>
                {' le debe '}
                <Text style={{ fontWeight: '700' }}>{fmtCOP(deudaNeta.monto)}</Text>
                {' a '}
                <Text style={{ fontWeight: '700' }}>{deudaNeta.acreedor}</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: colors.incomeLight }]}>
            <View style={s.balanceRow}>
              <Icon name="check-circle" size={18} color={colors.income} />
              <Text style={[s.balanceTxt, { color: colors.incomeText }]}>¡Están a mano! No hay deudas pendientes.</Text>
            </View>
          </View>
        )}

        {/* Detalle de balances por persona */}
        {balances.map(b => (
          <View key={b.userId} style={[s.balanceDetail, { backgroundColor: colors.card }]}>
            <Text style={[s.balanceNombre, { color: colors.textPrimary }]}>{b.displayName}</Text>
            <View style={s.balanceNums}>
              <View>
                <Text style={[s.balanceSubLabel, { color: colors.textTertiary }]}>Pagó</Text>
                <Text style={[s.balanceNum, { color: colors.income }]}>{fmtCOP(b.totalPaid)}</Text>
              </View>
              <View>
                <Text style={[s.balanceSubLabel, { color: colors.textTertiary }]}>Le corresponde</Text>
                <Text style={[s.balanceNum, { color: colors.expense }]}>{fmtCOP(b.totalOwed)}</Text>
              </View>
              <View>
                <Text style={[s.balanceSubLabel, { color: colors.textTertiary }]}>Neto</Text>
                <Text style={[s.balanceNum, { color: b.net >= 0 ? colors.income : colors.expense }]}>
                  {b.net >= 0 ? '+' : ''}{fmtCOP(b.net)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Gastos recientes */}
        <Text style={[s.seccion, { color: colors.textTertiary }]}>GASTOS RECIENTES</Text>
        {gastos.length === 0 ? (
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.emptyGasto, { color: colors.textSecondary }]}>
              Aún no hay gastos compartidos. ¡Registra el primero!
            </Text>
          </View>
        ) : (
          gastos.map(g => (
            <View key={g.id} style={[s.gastoRow, { backgroundColor: colors.card }]}>
              <View style={[s.gastoIcono, { backgroundColor: colors.expenseLight }]}>
                <Icon name="dollar-sign" size={16} color={colors.expense} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.gastoCategoria, { color: colors.textPrimary }]}>{g.category}</Text>
                {g.description ? (
                  <Text style={[s.gastoDesc, { color: colors.textSecondary }]}>{g.description}</Text>
                ) : null}
                <Text style={[s.gastoFecha, { color: colors.textTertiary }]}>
                  {g.date} · Pagó {g.paidByName}
                </Text>
              </View>
              <Text style={[s.gastoMonto, { color: colors.expense }]}>{fmtCOP(g.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB — agregar gasto */}
      <View style={[s.fab, { bottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[s.fabBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalGasto(true)}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={24} color="#fff" />
          <Text style={s.fabTxt}>Registrar gasto</Text>
        </TouchableOpacity>
      </View>

      {/* Modal: registrar gasto */}
      <Modal visible={modalGasto} animationType="slide" presentationStyle="pageSheet">
        <RegistrarGastoCompartidoScreen
          spaceId={espacio.id}
          onGastoRegistrado={() => { setModalGasto(false); cargarDatos(true); }}
          onCancelar={() => setModalGasto(false)}
        />
      </Modal>

      {/* Modal: código de invitación */}
      <Modal visible={modalInv} animationType="slide" presentationStyle="pageSheet">
        {invActual && (
          <MostrarCodigoInvitacion
            espacio={espacio}
            invitacion={invActual}
            onRegenerarCodigo={setInvActual}
            onIrAlEspacio={() => setModalInv(false)}
          />
        )}
      </Modal>
    </>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cargandoTxt: { marginTop: 16, fontSize: 15 },
  emptyTitulo: { fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySubtitulo: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btnVolver: { marginTop: 24, borderWidth: 1, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 20, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSubtitulo: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  invBtn: { padding: 8 },
  privacyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  privacyTxt: { fontSize: 12, flex: 1, lineHeight: 16 },
  card: { borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 12 },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  totalMes: { fontSize: 32, fontWeight: '800', marginBottom: 12 },
  miembrosRow: { flexDirection: 'row', gap: 8 },
  miembroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  miembroEmoji: { fontSize: 14 },
  miembroNombre: { fontSize: 13, fontWeight: '600' },
  seccion: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  balanceTxt: { flex: 1, fontSize: 14, lineHeight: 20 },
  balanceDetail: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, padding: 14 },
  balanceNombre: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  balanceNums: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceSubLabel: { fontSize: 11, marginBottom: 2 },
  balanceNum: { fontSize: 15, fontWeight: '700' },
  gastoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 8, borderRadius: 14, padding: 14,
  },
  gastoIcono: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gastoCategoria: { fontSize: 14, fontWeight: '600' },
  gastoDesc: { fontSize: 12, marginTop: 1 },
  gastoFecha: { fontSize: 11, marginTop: 2 },
  gastoMonto: { fontSize: 15, fontWeight: '700' },
  emptyGasto: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  fab: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  fabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
