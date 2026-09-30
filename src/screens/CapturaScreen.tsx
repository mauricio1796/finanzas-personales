/**
 * Registro automático (Premium) — fase 1 de la captura de compras.
 *
 * El usuario pega uno o varios SMS, notificaciones o correos del banco; Finn
 * reconoce cada movimiento, evita duplicados, lo asocia a su tarjeta o cuenta
 * y lo registra en la categoría correcta. Lo que no tiene claro queda en la
 * bandeja "Por confirmar". En la fase 2 la misma bandeja se llenará sola
 * desde las notificaciones del banco (Android).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { PremiumLock } from '../components/ui/PremiumLock';
import { MedioPagoSelector } from '../components/finanzas/MedioPagoSelector';
import { DeteccionAutomaticaCard } from '../components/finanzas/DeteccionAutomaticaCard';
import { THEME } from '../constants/theme';
import { consentService } from '../services/ConsentService';
import { analizarMensajes, categoriasDeGasto, sugerirCategoriaConFinn } from '../services/CapturaService';
import { OPCIONES_INGRESO, type CapturaPendiente, type ItemResultado } from '../utils/capturaMotor';
import { entidadPorId, etiquetaMedio } from '../utils/mediosPago';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

function fmtFecha(iso: string, conHora: boolean, estimada: boolean): string {
  if (estimada) return 'Fecha aproximada';
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return conHora ? `${dia} · ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}` : dia;
}

const ICONO_TIPO = { compra: 'shopping-bag', pago: 'file-text', transferencia: 'send', retiro: 'dollar-sign', ingreso: 'arrow-down-left' } as const;
const CANAL = { tarjeta: 'Tarjeta', pse: 'PSE', breb: 'Bre-B', cuenta: 'Cuenta', billetera: 'Billetera', desconocido: '' } as const;

const ESTADO_UI: Record<ItemResultado['estado'], { icon: string; label: string; color: 'income' | 'warning' | 'textTertiary' | 'primary' }> = {
  registrado:    { icon: 'check-circle', label: 'Registrado',     color: 'income' },
  por_confirmar: { icon: 'help-circle',  label: 'Por confirmar',  color: 'warning' },
  duplicado:     { icon: 'copy',         label: 'Ya estaba',      color: 'textTertiary' },
  ignorado:      { icon: 'slash',        label: 'Ignorado',       color: 'textTertiary' },
  no_reconocido: { icon: 'x-circle',     label: 'No reconocido',  color: 'textTertiary' },
};

// ─── Tarjeta de un movimiento por confirmar ───────────────────────────────────

interface PendienteProps {
  p: CapturaPendiente;
  onConfirmar: (p: CapturaPendiente, categoria: { id?: string; name: string }, medioId: string | null, esIngreso: boolean) => void;
  onIgnorar: (p: CapturaPendiente) => void;
  onPedirFinn: (p: CapturaPendiente) => void;
  finnCargando: boolean;
}

const PendienteCard: React.FC<PendienteProps> = ({ p, onConfirmar, onIgnorar, onPedirFinn, finnCargando }) => {
  const { colors } = useTheme();
  const { categories } = useFinance();
  const m = p.movimiento;
  const esIngreso = m.tipo === 'ingreso';

  const opciones = useMemo(() => {
    if (esIngreso) return OPCIONES_INGRESO.map(o => ({ id: o.id, name: o.label, key: o.id }));
    const lista = categoriasDeGasto(categories).map(c => ({ id: c.id, name: c.name, key: c.id }));
    const sug = p.sugerencia;
    return sug ? [...lista.filter(c => c.id === sug.categoryId), ...lista.filter(c => c.id !== sug.categoryId)] : lista;
  }, [categories, esIngreso, p.sugerencia]);

  // Mientras el usuario no elija, vale la sugerencia (también si Finn responde después).
  const [catElegida, setCatElegida] = useState<string | null | undefined>(undefined);
  const catSel = catElegida === undefined ? p.sugerencia?.categoryId ?? null : catElegida;
  const setCatSel = setCatElegida;
  const [medioSel, setMedioSel] = useState<string | null>(p.medioId ?? null);

  const titulo = m.comercio ?? (m.destinatario ? `${esIngreso ? 'De' : 'A'} ${m.destinatario}` : m.detalle ?? 'Movimiento');
  const elegida = opciones.find(o => o.key === catSel);

  return (
    <View style={[pc.card, { backgroundColor: colors.card, borderColor: p.sugerirIgnorar ? colors.border : colors.warning + '55' }]} testID={`pendiente-${p.id}`}>
      <View style={pc.top}>
        <View style={[pc.icono, { backgroundColor: esIngreso ? colors.incomeLight : colors.expenseLight }]}>
          <Icon name={ICONO_TIPO[m.tipo] as any} size={16} color={esIngreso ? colors.income : colors.expense} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pc.titulo, { color: colors.textPrimary }]} numberOfLines={1}>{titulo}</Text>
          <Text style={[pc.sub, { color: colors.textTertiary }]} numberOfLines={1}>
            {[CANAL[m.canal], m.entidad ? entidadPorId(m.entidad).nombre : null, fmtFecha(m.fecha, m.fechaConHora, m.fechaEstimada)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={[pc.monto, { color: esIngreso ? colors.income : colors.textPrimary }]}>
          {esIngreso ? '+' : '-'}{fmt(m.monto)}
        </Text>
      </View>

      <View style={[pc.finn, { backgroundColor: colors.aiLight }]}>
        <Icon name="message-circle" size={13} color={colors.ai} />
        <Text style={[pc.finnText, { color: colors.aiText }]}>{p.motivo}</Text>
      </View>

      {!p.sugerirIgnorar && (
        <>
          <View style={{ marginTop: 12 }}>
            <MedioPagoSelector value={medioSel} onChange={setMedioSel} accent={colors.primary} label="PAGADO CON" />
          </View>

          <View style={pc.catHeader}>
            <Text style={[pc.label, { color: colors.textTertiary }]}>{esIngreso ? 'TIPO DE INGRESO' : 'CATEGORÍA'}</Text>
            {!esIngreso && !p.sugerencia && m.comercio && (m.tipo === 'compra' || m.tipo === 'pago') && (
              <TouchableOpacity onPress={() => onPedirFinn(p)} disabled={finnCargando} style={pc.finnBtn}>
                {finnCargando
                  ? <ActivityIndicator size="small" color={colors.ai} />
                  : <><Icon name="zap" size={12} color={colors.ai} /><Text style={[pc.finnBtnText, { color: colors.ai }]}>Preguntar a Finn</Text></>}
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {opciones.map(o => {
              const activa = catSel === o.key;
              const sugerida = !esIngreso && p.sugerencia?.categoryId === o.id;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setCatSel(activa ? null : o.key); }}
                  style={[pc.chip, { borderColor: activa ? colors.primary : colors.border, backgroundColor: activa ? colors.primaryLight : 'transparent' }]}
                >
                  {sugerida && <Icon name="star" size={11} color={activa ? colors.primary : colors.warning} />}
                  <Text style={[pc.chipText, { color: activa ? colors.primary : colors.textSecondary }]}>{o.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={pc.acciones}>
        <TouchableOpacity
          style={[pc.btn, { borderColor: colors.border, backgroundColor: p.sugerirIgnorar ? colors.primary : 'transparent' }]}
          onPress={() => onIgnorar(p)}
          testID={`ignorar-${p.id}`}
        >
          <Text style={[pc.btnText, { color: p.sugerirIgnorar ? '#fff' : colors.textSecondary }]}>
            {p.sugerirIgnorar ? 'No es un gasto' : 'Ignorar'}
          </Text>
        </TouchableOpacity>
        {p.sugerirIgnorar ? (
          <TouchableOpacity style={[pc.btn, { borderColor: colors.border }]} onPress={() => onConfirmar({ ...p, sugerirIgnorar: false }, { name: '' }, medioSel, esIngreso)} testID={`registrar-igual-${p.id}`}>
            <Text style={[pc.btnText, { color: colors.textSecondary }]}>Sí es un gasto</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[pc.btn, { borderColor: elegida ? colors.primary : colors.border, backgroundColor: elegida ? colors.primary : colors.cardSecondary }]}
            disabled={!elegida}
            onPress={() => elegida && onConfirmar(p, { ...(esIngreso ? {} : { id: elegida.id }), name: esIngreso ? elegida.key : elegida.name }, medioSel, esIngreso)}
            testID={`registrar-${p.id}`}
          >
            <Text style={[pc.btnText, { color: elegida ? '#fff' : colors.textTertiary }]}>
              {elegida ? `Registrar en ${elegida.name}` : 'Elige una categoría'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────

interface CapturaScreenProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export const CapturaScreen: React.FC<CapturaScreenProps> = ({ onBack, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    premium, categories, mediosPago, transactions, user, profile,
    capturasPendientes, reglasComercio, huellasIgnoradas, titularesBanco,
    aplicarLoteCaptura, confirmarCaptura, ignorarCaptura, actualizarCaptura,
  } = useFinance();

  const [texto, setTexto]             = useState('');
  const [analizando, setAnalizando]   = useState(false);
  const [resultado, setResultado]     = useState<ItemResultado[] | null>(null);
  const [conIA, setConIA]             = useState(false);
  const [finnCargando, setFinnCargando] = useState<Set<string>>(new Set());

  useEffect(() => { consentService.hasAIConsent().then(setConIA).catch(() => setConIA(false)); }, []);

  if (!premium.isPremium) {
    return (
      <View style={[st.screen, { backgroundColor: colors.background }]}>
        <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onBack} style={st.backBtn} accessibilityLabel="Volver">
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Registro automático</Text>
        </View>
        <PremiumLock
          title="Registro automático de compras"
          description="Pega los SMS o correos de tu banco y Finn registra cada compra en la categoría correcta, con tu tarjeta o Nequi, sin duplicados."
          onUpgrade={() => onNavigate('premium')}
          onDismiss={onBack}
        />
      </View>
    );
  }

  // El nombre del titular ayuda a reconocer envíos entre sus propias cuentas.
  // (mainFinancialConcern guarda en realidad el nombre del usuario.)
  const nombresUsuario = [user?.name, profile?.mainFinancialConcern, ...titularesBanco].filter((n): n is string => !!n);

  const pegar = async () => {
    const t = await Clipboard.getStringAsync().catch(() => '');
    if (t) setTexto(prev => (prev.trim() ? `${prev.trim()}\n\n${t}` : t));
    Haptics.selectionAsync().catch(() => {});
  };

  const analizar = async () => {
    if (!texto.trim() || analizando) return;
    Keyboard.dismiss();
    setAnalizando(true);
    try {
      const lote = await analizarMensajes(texto, {
        categories, medios: mediosPago, reglas: reglasComercio, transactions,
        pendientes: capturasPendientes, huellasIgnoradas, nombresUsuario,
      }, { usarFinn: conIA });
      aplicarLoteCaptura(lote);
      setResultado(lote.items);
      setTexto(''); // el texto crudo no se conserva
      Haptics.notificationAsync(
        lote.registrar.length > 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    } finally {
      setAnalizando(false);
    }
  };

  const pedirFinn = async (p: CapturaPendiente) => {
    setFinnCargando(prev => new Set(prev).add(p.id));
    const s = await sugerirCategoriaConFinn(p, categories);
    setFinnCargando(prev => { const n = new Set(prev); n.delete(p.id); return n; });
    if (s) actualizarCaptura(p.id, { sugerencia: s, motivo: `Finn cree que va en ${s.categoryName}.` });
    else actualizarCaptura(p.id, { motivo: conIA ? 'Finn tampoco lo reconoce: elige la categoría.' : 'Activa el procesamiento con IA en Privacidad para que Finn te ayude.' });
  };

  const confirmar = (p: CapturaPendiente, categoria: { id?: string; name: string }, medioId: string | null, esIngreso: boolean) => {
    if (!categoria.name) {
      // "Sí es un gasto" en algo que Finn sugería ignorar: se muestra con categorías.
      actualizarCaptura(p.id, { sugerirIgnorar: false, motivo: 'Elige la categoría.' });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    confirmarCaptura(p.id, { categoria, medioId, esIngreso });
  };

  const ignorar = (p: CapturaPendiente) => {
    Haptics.selectionAsync().catch(() => {});
    ignorarCaptura(p.id);
  };

  const conteo = resultado?.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.estado]: (acc[i.estado] ?? 0) + 1 }), {});

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} accessibilityLabel="Volver">
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Registro automático</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Detección automática desde notificaciones (Android) ────── */}
        <DeteccionAutomaticaCard />

        {/* ── Entrada ─────────────────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={st.cardHeader}>
            <View style={[st.cardIcon, { backgroundColor: colors.aiLight }]}>
              <Icon name="zap" size={16} color={colors.ai} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.cardTitle, { color: colors.textPrimary }]}>Pega los mensajes de tu banco</Text>
              <Text style={[st.cardSub, { color: colors.textTertiary }]}>SMS, notificaciones o correos. Uno o varios a la vez.</Text>
            </View>
          </View>

          <TextInput
            style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
            value={texto}
            onChangeText={setTexto}
            placeholder={'Banco de Bogota: Tu compra por 23,900 fue aprobada con Tarjeta Crédito 0897…'}
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            testID="captura-texto"
          />

          <View style={st.fila}>
            <TouchableOpacity style={[st.btnSec, { borderColor: colors.border }]} onPress={pegar} testID="captura-pegar">
              <Icon name="clipboard" size={16} color={colors.textSecondary} />
              <Text style={[st.btnSecText, { color: colors.textSecondary }]}>Pegar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btnPri, { backgroundColor: texto.trim() ? colors.primary : colors.border, flex: 1 }]}
              onPress={analizar}
              disabled={!texto.trim() || analizando}
              testID="captura-analizar"
            >
              {analizando
                ? <ActivityIndicator color="#fff" />
                : <><Icon name="cpu" size={16} color="#fff" /><Text style={st.btnPriText}>Analizar con Finn</Text></>}
            </TouchableOpacity>
          </View>

          <View style={st.privacidad}>
            <Icon name="lock" size={11} color={colors.textTertiary} />
            <Text style={[st.privacidadText, { color: colors.textTertiary }]}>
              El texto se analiza en tu celular y no se guarda. {conIA
                ? 'Para comercios nuevos, Finn IA solo recibe el nombre del comercio y el monto.'
                : 'Activa «Procesamiento con IA» en Privacidad para que Finn reconozca comercios nuevos.'}
            </Text>
          </View>
        </View>

        {/* ── Resultado del último análisis ───────────────────────────── */}
        {resultado && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.label, { color: colors.textTertiary }]}>RESULTADO</Text>
            <Text style={[st.resumen, { color: colors.textPrimary }]}>
              {[
                conteo?.registrado ? `${conteo.registrado} registrado${conteo.registrado > 1 ? 's' : ''}` : null,
                conteo?.por_confirmar ? `${conteo.por_confirmar} por confirmar` : null,
                conteo?.duplicado ? `${conteo.duplicado} ya estaba${conteo.duplicado > 1 ? 'n' : ''}` : null,
                (conteo?.ignorado ?? 0) + (conteo?.no_reconocido ?? 0) ? `${(conteo?.ignorado ?? 0) + (conteo?.no_reconocido ?? 0)} ignorado${(conteo?.ignorado ?? 0) + (conteo?.no_reconocido ?? 0) > 1 ? 's' : ''}` : null,
              ].filter(Boolean).join(' · ') || 'Sin movimientos'}
            </Text>
            {resultado.map((it, i) => {
              const ui = ESTADO_UI[it.estado];
              const color = colors[ui.color];
              const m = it.movimiento;
              const medio = it.medioId ? mediosPago.find(x => x.id === it.medioId) : undefined;
              return (
                <View key={i} style={[st.itemRes, { borderTopColor: colors.border }]}>
                  <Icon name={ui.icon as any} size={16} color={color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.itemTitulo, { color: colors.textPrimary }]} numberOfLines={1}>
                      {m ? `${fmt(m.monto)} · ${m.comercio ?? m.destinatario ?? m.detalle ?? 'Movimiento'}` : ui.label}
                    </Text>
                    <Text style={[st.itemSub, { color: colors.textTertiary }]} numberOfLines={2}>
                      {it.estado === 'registrado' ? `${it.categoria}${medio ? ` · ${etiquetaMedio(medio)}` : ''}` : it.motivo}
                    </Text>
                  </View>
                  <Text style={[st.itemEstado, { color }]}>{ui.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Bandeja ─────────────────────────────────────────────────── */}
        <View style={st.bandejaHeader}>
          <Text style={[st.label, { color: colors.textTertiary, marginBottom: 0 }]}>
            POR CONFIRMAR{capturasPendientes.length > 0 ? ` (${capturasPendientes.length})` : ''}
          </Text>
        </View>
        {capturasPendientes.length === 0 ? (
          <Text style={[st.vacio, { color: colors.textTertiary }]}>
            Todo al día. Lo que Finn no pueda registrar solo aparecerá aquí.
          </Text>
        ) : capturasPendientes.map(p => (
          <PendienteCard
            key={p.id}
            p={p}
            onConfirmar={confirmar}
            onIgnorar={ignorar}
            onPedirFinn={pedirFinn}
            finnCargando={finnCargando.has(p.id)}
          />
        ))}

        {mediosPago.length === 0 && (
          <TouchableOpacity style={[st.tip, { backgroundColor: colors.primaryLight }]} onPress={() => onNavigate('billetera')}>
            <Icon name="credit-card" size={16} color={colors.primary} />
            <Text style={[st.tipText, { color: colors.primaryText }]}>
              Agrega tus tarjetas y cuentas en Mi billetera para que Finn sepa con qué pagaste.
            </Text>
            <Icon name="chevron-right" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const pc = StyleSheet.create({
  card:       { borderWidth: 1.5, borderRadius: THEME.radius.lg, padding: 16, marginBottom: 12 },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono:      { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo:     { fontSize: 15, fontWeight: '700' },
  sub:        { fontSize: 12, marginTop: 2 },
  monto:      { fontSize: 16, fontWeight: '800' },
  finn:       { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 10, marginTop: 12, alignItems: 'flex-start' },
  finnText:   { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '500' },
  catHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 },
  label:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  finnBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 20 },
  finnBtnText:{ fontSize: 12, fontWeight: '700' },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:   { fontSize: 13, fontWeight: '600' },
  acciones:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn:        { flex: 1, borderWidth: 1, borderRadius: THEME.radius.md, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnText:    { fontSize: 13, fontWeight: '700' },
});

const st = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginLeft: 8 },
  card:          { borderWidth: 1, borderRadius: THEME.radius.lg, padding: 16, marginBottom: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: 15, fontWeight: '700' },
  cardSub:       { fontSize: 12, marginTop: 2 },
  input:         { borderWidth: 1, borderRadius: THEME.radius.md, padding: 12, minHeight: 120, maxHeight: 260, fontSize: 14 },
  fila:          { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnSec:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: THEME.radius.md, paddingHorizontal: 16, paddingVertical: 12 },
  btnSecText:    { fontSize: 14, fontWeight: '700' },
  btnPri:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: THEME.radius.md, paddingVertical: 12 },
  btnPriText:    { color: '#fff', fontSize: 14, fontWeight: '800' },
  privacidad:    { flexDirection: 'row', gap: 6, marginTop: 12 },
  privacidadText:{ flex: 1, fontSize: 11, lineHeight: 15 },
  label:         { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  resumen:       { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  itemRes:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  itemTitulo:    { fontSize: 13.5, fontWeight: '600' },
  itemSub:       { fontSize: 11.5, marginTop: 2 },
  itemEstado:    { fontSize: 11, fontWeight: '700' },
  bandejaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  vacio:         { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  tip:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: THEME.radius.md, padding: 14, marginTop: 4 },
  tipText:       { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
