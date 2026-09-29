import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { PremiumBadge } from '../components/ui/PremiumBadge';
import { ConfettiBurst } from '../components/ui/ConfettiBurst';
import type { Meta } from '../types';
import { THEME } from '../constants/theme';
import { montoVinculadoMeta, sugerirFondoEmergencia } from '../utils/metasUtils';
import { getAhorroRealMes, esCategoriaAhorro } from '../utils/ingresoUtils';

const METAS_GRATIS = 1;
const XP_POR_META = 150;

const EMOJIS = ['🎯','🏠','✈️','🚗','💍','📚','💻','🏋️','🌴','💰','🎓','🎮'];
const COLORS  = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

/** Sugerencia de aporte semanal para llegar a tiempo a la fecha límite. */
function sugerenciaSemanal(meta: Meta): { monto: number; semanas: number } | null {
  if (!meta.fechaLimite) return null;
  const hoy   = new Date();
  const limite = new Date(meta.fechaLimite);
  const msRestantes = limite.getTime() - hoy.getTime();
  if (isNaN(msRestantes) || msRestantes <= 0) return null;
  const semanas  = Math.max(1, Math.ceil(msRestantes / (7 * 24 * 60 * 60 * 1000)));
  const faltante = Math.max(meta.montoObjetivo - meta.montoActual, 0);
  if (faltante <= 0) return null;
  return { monto: Math.ceil(faltante / semanas), semanas };
}

interface MetaFormProps {
  visible: boolean;
  initial?: Meta | null;
  onClose: () => void;
  onSave: (meta: Omit<Meta, 'id' | 'creadaEn' | 'completada' | 'montoActual'>) => void;
}

const MetaForm: React.FC<MetaFormProps> = ({ visible, initial, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const esEdicion = !!initial;

  const [nombre, setNombre]     = useState(initial?.nombre ?? '');
  const [objetivo, setObjetivo] = useState(initial ? initial.montoObjetivo.toLocaleString('es-CO').replace(/,/g, '.') : '');
  const [emoji, setEmoji]       = useState(initial?.emoji ?? '🎯');
  const [color, setColor]       = useState(initial?.color ?? '#6366F1');
  const [fecha, setFecha]       = useState(initial?.fechaLimite ?? '');

  // Reinicia el formulario cada vez que cambia qué meta se está editando (o se abre para crear)
  React.useEffect(() => {
    if (!visible) return;
    setNombre(initial?.nombre ?? '');
    setObjetivo(initial ? initial.montoObjetivo.toLocaleString('es-CO').replace(/,/g, '.') : '');
    setEmoji(initial?.emoji ?? '🎯');
    setColor(initial?.color ?? '#6366F1');
    setFecha(initial?.fechaLimite ?? '');
  }, [visible, initial]);

  const handleSave = () => {
    const monto = parseInt(objetivo.replace(/\./g, ''), 10);
    if (!nombre.trim() || !monto) return;
    onSave({ nombre: nombre.trim(), montoObjetivo: monto, emoji, color, fechaLimite: fecha || undefined });
    onClose();
  };

  return (
    <Modal testID="meta-form-modal" transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.textPrimary }]}>{esEdicion ? 'Editar Meta' : 'Nueva Meta'}</Text>

            <Text style={[st.label, { color: colors.textTertiary }]}>EMOJI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)}
                  style={[st.emojiBtn, emoji === e && { borderColor: color, borderWidth: 2 }]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[st.label, { color: colors.textTertiary }]}>COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setColor(c)}
                  style={[st.colorDot, { backgroundColor: c }, color === c && st.colorDotActive]} />
              ))}
            </ScrollView>

            <TextInput testID="meta-title-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Nombre de la meta" placeholderTextColor={colors.textTertiary}
              value={nombre} onChangeText={setNombre} />

            <TextInput testID="meta-target-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Monto objetivo (COP)" placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={objetivo}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setObjetivo(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />

            <TextInput testID="meta-deadline-input" style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Fecha límite (AAAA-MM-DD, opcional)" placeholderTextColor={colors.textTertiary}
              value={fecha} onChangeText={setFecha} />

            <TouchableOpacity testID="meta-save-btn" style={[st.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
              <Text style={st.saveBtnText}>{esEdicion ? 'Guardar cambios' : 'Crear Meta'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface AbonoModalProps {
  meta: Meta | null;
  /** abono: aparta plata del disponible · retiro: la devuelve al disponible. */
  modo?: 'abono' | 'retiro';
  onClose: () => void;
  onAbono: (monto: number) => void;
}

const AbonoModal: React.FC<AbonoModalProps> = ({ meta, modo = 'abono', onClose, onAbono }) => {
  const { colors } = useTheme();
  const [monto, setMonto] = useState('');
  if (!meta) return null;

  const esRetiro = modo === 'retiro';
  const sugerido = esRetiro ? null : sugerenciaSemanal(meta);

  const handleAbono = () => {
    const m = parseInt(monto.replace(/\./g,''), 10);
    if (!m || m <= 0) return;
    onAbono(esRetiro ? Math.min(m, meta.montoActual) : m);
    setMonto('');
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={!!meta} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.abonoCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>{meta.emoji}</Text>
            <Text style={[st.abonoTitle, { color: colors.textPrimary }]}>
              {esRetiro ? `Retirar de "${meta.nombre}"` : `Abonar a "${meta.nombre}"`}
            </Text>
            <Text style={[st.abonoSub, { color: colors.textTertiary }]}>
              {fmt(meta.montoActual)} de {fmt(meta.montoObjetivo)}
            </Text>
            <Text style={[st.abonoSub, { color: colors.textTertiary, marginTop: 4 }]}>
              {esRetiro
                ? 'La plata vuelve a tu disponible del mes.'
                : 'Sale de tu disponible del mes y queda apartada: no cuenta como gasto.'}
            </Text>
            {sugerido && (
              <TouchableOpacity onPress={() => setMonto(sugerido.monto.toLocaleString('es-CO').replace(/,/g, '.'))} style={[st.sugerenciaChip, { backgroundColor: meta.color + '18' }]}>
                <Icon name="zap" size={11} color={meta.color} />
                <Text style={[st.sugerenciaText, { color: meta.color }]}>
                  Sugerido: {fmt(sugerido.monto)}/semana para llegar a tiempo
                </Text>
              </TouchableOpacity>
            )}
            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary, marginTop: 16 }]}
              placeholder={esRetiro ? 'Monto a retirar' : 'Monto a abonar'} placeholderTextColor={colors.textTertiary}
              keyboardType="numeric" value={monto}
              onChangeText={t => { const d = t.replace(/\./g,'').replace(/\D/g,''); const n = parseInt(d,10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO').replace(/,/g,'.')); }} />
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: meta.color }]} onPress={handleAbono}>
              <Text style={st.saveBtnText}>{esRetiro ? 'Retirar' : 'Abonar'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface MetasScreenProps { onBack: () => void; onPremiumPress?: () => void; }

export const MetasScreen: React.FC<MetasScreenProps> = ({ onBack, onPremiumPress }) => {
  const insets                                        = useSafeAreaInsets();
  const { colors }                                    = useTheme();
  const {
    metas, addMeta, updateMeta, deleteMeta, abonarMeta, retirarDeMeta, premium, transactions,
    serieAhorro, categories, profile,
  } = useFinance();
  const [showForm, setShowForm]                       = useState(false);
  const [metaEnEdicion, setMetaEnEdicion]              = useState<Meta | null>(null);
  const [abonoTarget, setAbonoTarget]                  = useState<Meta | null>(null);
  const [retiroTarget, setRetiroTarget]                = useState<Meta | null>(null);
  const [celebrar, setCelebrar]                        = useState(false);

  const activasCount   = metas.filter(m => !m.completada).length;
  const alcanzoLimite  = !premium.isPremium && activasCount >= METAS_GRATIS;

  // Fondo de emergencia sugerido: 3–6 meses de gasto real (meses cerrados y
  // completos); sin historial todavía, con el presupuesto mensual.
  const sugerenciaFondo = React.useMemo(() => {
    const salario = profile?.monthlySalary ?? 0;
    const gastos = serieAhorro.slice(1)
      .filter(p => !p.sinDatos && !p.enCurso)
      .slice(-3)
      .map(p => getAhorroRealMes(transactions, salario, p.mes, p.año).gastado);
    const presupuesto = categories
      .filter(c => c.isSelected && c.tipo !== 'ingreso' && !esCategoriaAhorro(c.name))
      .reduce((s, c) => s + (c.budget ?? 0), 0);
    return sugerirFondoEmergencia(metas, gastos, presupuesto);
  }, [metas, serieAhorro, transactions, categories, profile?.monthlySalary]);

  const crearFondoEmergencia = () => {
    if (!sugerenciaFondo) return;
    if (alcanzoLimite) { onPremiumPress?.(); return; }
    addMeta({
      id: Date.now().toString(),
      nombre: 'Fondo de emergencia',
      montoObjetivo: sugerenciaFondo.minimo,
      montoActual: 0,
      emoji: '🛟',
      color: '#14B8A6',
      completada: false,
      creadaEn: new Date().toISOString(),
    });
  };

  const handlePressAdd = () => {
    if (alcanzoLimite) { onPremiumPress?.(); return; }
    setMetaEnEdicion(null);
    setShowForm(true);
  };

  const handleEditar = (meta: Meta) => {
    setMetaEnEdicion(meta);
    setShowForm(true);
  };

  const handleSave = (data: Omit<Meta, 'id' | 'creadaEn' | 'completada' | 'montoActual'>) => {
    if (metaEnEdicion) {
      updateMeta(metaEnEdicion.id, data);
      setMetaEnEdicion(null);
    } else {
      addMeta({
        ...data,
        id: Date.now().toString(),
        montoActual: 0,
        completada: false,
        creadaEn: new Date().toISOString(),
      });
    }
  };

  const handleEliminar = (meta: Meta) => {
    // Solo vuelve al disponible lo que salió de él (abonos con movimiento).
    const devolvible = Math.min(meta.montoActual, montoVinculadoMeta(transactions, meta.id));
    if (devolvible > 0) {
      Alert.alert(
        `¿Eliminar "${meta.nombre}"?`,
        meta.completada
          ? `Tiene ${fmt(devolvible)} apartados. Si ya los usaste, elimínala sin devolver.`
          : `Tienes ${fmt(devolvible)} apartados en esta meta. ¿Los devolvemos a tu disponible?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar sin devolver', style: 'destructive', onPress: () => deleteMeta(meta.id) },
          { text: 'Devolver y eliminar', onPress: () => deleteMeta(meta.id, { devolver: true }) },
        ],
      );
      return;
    }
    Alert.alert(
      `¿Eliminar "${meta.nombre}"?`,
      meta.montoActual > 0
        ? `Llevas ${fmt(meta.montoActual)} ahorrados en esta meta. Esta acción no se puede deshacer.`
        : 'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMeta(meta.id) },
      ],
    );
  };

  const handleAbono = (monto: number) => {
    if (!abonoTarget) return;
    const seCompleta = !abonoTarget.completada &&
      abonoTarget.montoActual + monto >= abonoTarget.montoObjetivo;

    abonarMeta(abonoTarget.id, monto);

    if (seCompleta) {
      setCelebrar(true);
      setTimeout(() => setCelebrar(false), 900);
      setTimeout(() => {
        Alert.alert('¡Meta alcanzada! 🎉', `Completaste "${abonoTarget.nombre}" y ganaste +${XP_POR_META} XP.`);
      }, 300);
    }
  };

  const activas    = metas.filter(m => !m.completada);
  const completadas = metas.filter(m => m.completada);

  return (
    <View testID="metas-screen" style={[st.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Mis Metas</Text>
        <TouchableOpacity testID="metas-add-btn" onPress={handlePressAdd} style={[st.addBtn, { backgroundColor: colors.primaryLight }]}>
          <Icon name={alcanzoLimite ? 'lock' : 'plus'} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {sugerenciaFondo && (
          <View testID="sugerencia-fondo-emergencia" style={[st.fondoCard, { backgroundColor: colors.card, borderColor: '#14B8A6' + '55' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 26 }}>🛟</Text>
              <View style={{ flex: 1 }}>
                <Text style={[st.cardNombre, { color: colors.textPrimary }]}>Tu fondo de emergencia</Text>
                <Text style={[st.cardFecha, { color: colors.textTertiary, marginTop: 2 }]}>
                  {sugerenciaFondo.fuente === 'historial'
                    ? `Gastas unos ${fmt(sugerenciaFondo.gastoMensual)} al mes`
                    : `Tu presupuesto es de ${fmt(sugerenciaFondo.gastoMensual)} al mes`}
                </Text>
              </View>
            </View>
            <Text style={[st.fondoTexto, { color: colors.textSecondary }]}>
              Lo primero antes que cualquier otra meta: {fmt(sugerenciaFondo.minimo)} cubren 3 meses de tus gastos si pierdes tu ingreso o surge un imprevisto. Lo ideal son 6 meses ({fmt(sugerenciaFondo.ideal)}).
            </Text>
            <TouchableOpacity onPress={crearFondoEmergencia} style={[st.abonoBtn, { backgroundColor: '#14B8A6', alignSelf: 'flex-start' }]}>
              <Text style={st.abonoBtnText}>
                {alcanzoLimite ? 'Crear con Premium' : `Crear meta de ${fmt(sugerenciaFondo.minimo)}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {metas.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 48 }}>🎯</Text>
            <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin metas aún</Text>
            <Text style={[st.emptySub, { color: colors.textTertiary }]}>Crea tu primera meta financiera y comienza a ahorrar con propósito.</Text>
          </View>
        )}

        {activas.length > 0 && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textTertiary }]}>EN PROGRESO</Text>
            {activas.map(meta => {
              const pct = Math.min(meta.montoActual / meta.montoObjetivo, 1);
              const sugerido = sugerenciaSemanal(meta);
              const numAportes = meta.aportes?.length ?? 0;
              return (
                <View key={meta.id} style={[st.card, { backgroundColor: colors.card }]}>
                  <View style={st.cardTop}>
                    <View style={[st.cardEmoji, { backgroundColor: meta.color + '20' }]}>
                      <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{meta.nombre}</Text>
                      <Text style={[st.cardMonto, { color: colors.textSecondary }]}>
                        {fmt(meta.montoActual)} / {fmt(meta.montoObjetivo)}
                      </Text>
                      <Text style={[st.cardFecha, { color: colors.textTertiary }]}>
                        {meta.fechaLimite ? `Límite: ${meta.fechaLimite}` : 'Sin fecha límite'}
                        {numAportes > 0 ? ` · ${numAportes} aporte${numAportes !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity onPress={() => handleEditar(meta)} style={st.deleteBtn} hitSlop={6}>
                        <Icon name="edit-2" size={15} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleEliminar(meta)} style={st.deleteBtn} hitSlop={6}>
                        <Icon name="trash-2" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[st.barBg, { backgroundColor: colors.border }]}>
                    <View style={[st.barFill, { width: `${pct * 100}%` as any, backgroundColor: meta.color }]} />
                  </View>
                  <View style={st.cardBottom}>
                    <Text style={[st.pctText, { color: meta.color }]}>{Math.round(pct * 100)}%</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {meta.montoActual > 0 && (
                        <TouchableOpacity testID={`meta-retirar-${meta.id}`} onPress={() => setRetiroTarget(meta)}
                          style={[st.abonoBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: meta.color }]}>
                          <Text style={[st.abonoBtnText, { color: meta.color }]}>Retirar</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => setAbonoTarget(meta)} style={[st.abonoBtn, { backgroundColor: meta.color }]}>
                        <Text style={st.abonoBtnText}>+ Abonar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {sugerido && (
                    <Text style={[st.sugerenciaInline, { color: colors.textTertiary }]}>
                      💡 Aporta {fmt(sugerido.monto)}/semana para llegar a tiempo ({sugerido.semanas} semana{sugerido.semanas !== 1 ? 's' : ''} restantes)
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {alcanzoLimite && (
          <TouchableOpacity
            onPress={() => onPremiumPress?.()}
            activeOpacity={0.85}
            style={[st.upsellCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '33' }]}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <PremiumBadge />
                <Text style={[st.upsellTitle, { color: colors.textPrimary }]}>Metas ilimitadas</Text>
              </View>
              <Text style={[st.upsellSub, { color: colors.textSecondary }]}>
                En Free puedes tener {METAS_GRATIS} meta activa. Con Premium creas todas las que quieras.
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {completadas.length > 0 && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>COMPLETADAS</Text>
            {completadas.map(meta => (
              <View key={meta.id} style={[st.card, { backgroundColor: colors.card, opacity: 0.7 }]}>
                <View style={st.cardTop}>
                  <View style={[st.cardEmoji, { backgroundColor: colors.incomeLight }]}>
                    <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[st.cardNombre, { color: colors.textPrimary }]}>{meta.nombre} ✓</Text>
                    <Text style={[st.cardMonto, { color: colors.income }]}>{fmt(meta.montoObjetivo)} alcanzado</Text>
                    {meta.montoActual > 0 && (
                      <TouchableOpacity onPress={() => setRetiroTarget(meta)} hitSlop={6} style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: meta.color }}>
                          Usar / retirar {fmt(meta.montoActual)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleEliminar(meta)} style={st.deleteBtn} hitSlop={6}>
                    <Icon name="trash-2" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <MetaForm
        visible={showForm}
        initial={metaEnEdicion}
        onClose={() => { setShowForm(false); setMetaEnEdicion(null); }}
        onSave={handleSave}
      />
      <AbonoModal meta={abonoTarget} onClose={() => setAbonoTarget(null)} onAbono={handleAbono} />
      <AbonoModal
        meta={retiroTarget}
        modo="retiro"
        onClose={() => setRetiroTarget(null)}
        onAbono={monto => { if (retiroTarget) retirarDeMeta(retiroTarget.id, monto); }}
      />

      <ConfettiBurst active={celebrar} />
    </View>
  );
};

const st = StyleSheet.create({
  fondoCard:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 18, gap: 10 },
  fondoTexto: { fontSize: 13, lineHeight: 19 },
  upsellCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, borderWidth: 1,
    padding: 14, marginTop: 4, marginBottom: 12,
  },
  upsellTitle: { fontSize: 13.5, fontWeight: '700' },
  upsellSub:   { fontSize: 12, lineHeight: 17 },
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginLeft: 8 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:     { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  card:         { borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardEmoji:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardNombre:   { fontSize: 15, fontWeight: '700' },
  cardMonto:    { fontSize: 13, marginTop: 2 },
  cardFecha:    { fontSize: 11, marginTop: 2 },
  deleteBtn:    { padding: 8 },
  barBg:        { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill:      { height: '100%', borderRadius: 3 },
  cardBottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pctText:      { fontSize: 13, fontWeight: '700' },
  abonoBtn:     { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  abonoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sugerenciaInline: { fontSize: 11, marginTop: 10 },
  // Sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  label:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  emojiBtn:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  colorDot:     { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.15 }] },
  input:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12 },
  saveBtn:      { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Abono
  abonoCard:    { margin: 24, borderRadius: 20, padding: 24 },
  abonoTitle:   { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  abonoSub:     { fontSize: 13, textAlign: 'center' },
  sugerenciaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'center', marginTop: 12 },
  sugerenciaText: { fontSize: 11.5, fontWeight: '600' },
});
