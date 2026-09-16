import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { THEME } from '../constants/theme';
import { Icon } from '../components/ui/Icon';
import { PremiumLock } from '../components/ui/PremiumLock';
import {
  generarYCompartirPDF,
  guardarPDFLocal,
  imprimirReporte,
  listarReportesGuardados,
  eliminarReporte,
  compartirReporteGuardado,
  type EstadoExportacion,
  type ReporteGuardado,
} from '../services/PDFService';
import type { ConfigReporte, DatosReporte } from '../utils/pdfUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function mesLabel(mes: number, año: number): string {
  const hoy = new Date();
  if (mes === hoy.getMonth() && año === hoy.getFullYear()) return 'Este mes';
  if (mes === hoy.getMonth() - 1 && año === hoy.getFullYear()) return 'Mes anterior';
  return `${MESES_CORTO[mes]} ${año}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  mesInicial?: { mes: number; año: number };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ExportarReporteScreen: React.FC<Props> = ({ onBack, onNavigate, mesInicial }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, categories, profile, goal, user, premium } = useFinance();

  // ── Month list (last 12) ───────────────────────────────────────────────────
  const hoy    = new Date();
  const meses  = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (11 - i), 1);
    return { mes: d.getMonth(), año: d.getFullYear() };
  });

  const defaultMes = mesInicial ?? { mes: hoy.getMonth(), año: hoy.getFullYear() };

  // ── Config state ───────────────────────────────────────────────────────────
  const [mesSelec, setMesSelec]     = useState(defaultMes);
  const [incGraficos, setIncGraficos]           = useState(true);
  const [incCategorias, setIncCategorias]       = useState(true);
  const [incTransacciones, setIncTransacciones] = useState(true);
  const [incProyeccion, setIncProyeccion]       = useState(true);
  const [filtroTipo, setFiltroTipo]             = useState<ConfigReporte['filtroTipo']>('todos');

  // ── Export state ───────────────────────────────────────────────────────────
  const [estado, setEstado]           = useState<EstadoExportacion>('idle');
  const [guardados, setGuardados]     = useState<ReporteGuardado[]>([]);
  const progressAnim                  = useRef(new Animated.Value(0)).current;
  const pulseAnim                     = useRef(new Animated.Value(1)).current;
  const pulseLoop                     = useRef<Animated.CompositeAnimation | null>(null);

  // ── Load saved reports ─────────────────────────────────────────────────────
  const cargarGuardados = useCallback(() => {
    listarReportesGuardados().then(setGuardados).catch(() => {});
  }, []);

  useEffect(() => { cargarGuardados(); }, [cargarGuardados]);

  // ── Progress animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (estado === 'generando' || estado === 'guardando') {
      Animated.timing(progressAnim, {
        toValue: estado === 'generando' ? 0.6 : 0.9,
        duration: 800,
        useNativeDriver: false,
      }).start();

      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else if (estado === 'listo') {
      pulseLoop.current?.stop();
      Animated.timing(progressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
        setTimeout(() => {
          Animated.timing(progressAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start();
          setEstado('idle');
          cargarGuardados();
        }, 1200);
      });
    } else if (estado === 'error') {
      pulseLoop.current?.stop();
      Animated.timing(progressAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats for selected month ──────────────────────────────────────
  const txsMes    = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === mesSelec.mes && d.getFullYear() === mesSelec.año;
  });
  const ingresos  = txsMes.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const gastos    = txsMes.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const ahorro    = ingresos - gastos;
  const fmt       = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CO').replace(/,/g, '.');

  // ── Build DatosReporte ────────────────────────────────────────────────────
  const buildDatos = useCallback((): DatosReporte => ({
    nombreUsuario: user?.name ?? 'Usuario',
    transactions,
    categories: categories as any,
    salary: profile?.monthlySalary ?? 0,
    goal: goal as any,
    config: {
      mes: mesSelec.mes,
      año: mesSelec.año,
      incluirGraficos: incGraficos,
      incluirCategorias: incCategorias,
      incluirTransacciones: incTransacciones,
      incluirProyeccion: incProyeccion,
      filtroTipo,
    },
  }), [user, transactions, categories, profile, goal, mesSelec, incGraficos, incCategorias, incTransacciones, incProyeccion, filtroTipo]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCompartir = async () => {
    if (estado !== 'idle') return;
    try {
      await generarYCompartirPDF(buildDatos(), setEstado);
    } catch {
      Alert.alert('Error', 'No se pudo generar el reporte. Intenta nuevamente.');
      setEstado('idle');
    }
  };

  const handleGuardar = async () => {
    if (estado !== 'idle') return;
    try {
      await guardarPDFLocal(buildDatos(), setEstado);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el reporte.');
      setEstado('idle');
    }
  };

  const handleImprimir = async () => {
    if (estado !== 'idle') return;
    try {
      setEstado('generando');
      await imprimirReporte(buildDatos());
      setEstado('idle');
    } catch {
      Alert.alert('Error', 'No se pudo abrir el visor de impresión.');
      setEstado('idle');
    }
  };

  const handleEliminar = (reporte: ReporteGuardado) => {
    Alert.alert(
      'Eliminar reporte',
      `¿Eliminar "${reporte.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => eliminarReporte(reporte.uri).then(cargarGuardados).catch(() => {}),
        },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoading  = estado === 'generando' || estado === 'guardando';
  const progressW  = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const estadoIcon = estado === 'listo' ? 'check-circle' : estado === 'error' ? 'alert-circle' : 'file-text';
  const estadoColor = estado === 'listo' ? colors.income : estado === 'error' ? colors.expense : colors.primary;

  if (!premium.isPremium) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onBack} style={[s.backBtn, { backgroundColor: colors.inputBg }]}>
            <Icon name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Exportar Reporte</Text>
          <View style={{ width: 38 }} />
        </View>
        <PremiumLock
          title="Exportar reportes en PDF"
          description="Genera y comparte un reporte financiero completo de cualquier mes, listo para guardar o imprimir."
          onUpgrade={() => onNavigate?.('premium')}
          onDismiss={onBack}
        />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={[s.backBtn, { backgroundColor: colors.inputBg }]}>
          <Icon name="arrow-left" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Exportar Reporte</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        {isLoading && (
          <View style={[s.progressWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.progressRow}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Icon name={estadoIcon} size={20} color={estadoColor} />
              </Animated.View>
              <Text style={[s.progressLabel, { color: colors.textPrimary }]}>
                {estado === 'generando' ? 'Generando PDF…' : 'Guardando archivo…'}
              </Text>
            </View>
            <View style={[s.progressTrack, { backgroundColor: colors.inputBg }]}>
              <Animated.View style={[s.progressFill, { width: progressW, backgroundColor: colors.primary }]} />
            </View>
          </View>
        )}
        {estado === 'listo' && (
          <View style={[s.progressWrap, { backgroundColor: colors.incomeLight, borderColor: colors.income }]}>
            <View style={s.progressRow}>
              <Icon name="check-circle" size={20} color={colors.income} />
              <Text style={[s.progressLabel, { color: colors.income }]}>¡Reporte generado con éxito!</Text>
            </View>
          </View>
        )}

        {/* Month selector */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>SELECCIONAR MES</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.monthScroll}
          contentContainerStyle={s.monthScrollContent}
        >
          {meses.map((m, i) => {
            const active = m.mes === mesSelec.mes && m.año === mesSelec.año;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.monthPill,
                  active
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border },
                ]}
                onPress={() => setMesSelec(m)}
              >
                <Text style={[s.monthPillText, { color: active ? '#fff' : colors.textSecondary }]}>
                  {mesLabel(m.mes, m.año)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Mini stats */}
        <View style={[s.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.statsTitle, { color: colors.textPrimary }]}>
            {MESES[mesSelec.mes]} {mesSelec.año}
          </Text>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: colors.income }]}>{fmt(ingresos)}</Text>
              <Text style={[s.statLbl, { color: colors.textTertiary }]}>Ingresos</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: colors.expense }]}>{fmt(gastos)}</Text>
              <Text style={[s.statLbl, { color: colors.textTertiary }]}>Gastos</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: ahorro >= 0 ? colors.income : colors.expense }]}>{fmt(ahorro)}</Text>
              <Text style={[s.statLbl, { color: colors.textTertiary }]}>Ahorro</Text>
            </View>
          </View>
          <Text style={[s.statsTxCount, { color: colors.textTertiary }]}>
            {txsMes.length} transacciones
          </Text>
        </View>

        {/* Section toggles */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>SECCIONES A INCLUIR</Text>
        <View style={[s.togglesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'Gráficos de categorías', icon: 'pie-chart' as const, value: incGraficos,       set: setIncGraficos       },
            { label: 'Análisis por categoría',  icon: 'tag'       as const, value: incCategorias,    set: setIncCategorias     },
            { label: 'Lista de transacciones',  icon: 'list'      as const, value: incTransacciones, set: setIncTransacciones  },
            { label: 'Proyecciones',            icon: 'trending-up' as const, value: incProyeccion,  set: setIncProyeccion     },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              style={[s.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[s.toggleIcon, { backgroundColor: colors.primaryLight }]}>
                <Icon name={item.icon} size={15} color={colors.primary} />
              </View>
              <Text style={[s.toggleLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              <Switch
                value={item.value}
                onValueChange={item.set}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={item.value ? colors.primary : colors.textTertiary}
              />
            </View>
          ))}
        </View>

        {/* Filtro transacciones */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>FILTRAR TRANSACCIONES</Text>
        <View style={[s.pillRow]}>
          {(['todos', 'ingresos', 'gastos'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                s.filterPill,
                filtroTipo === f
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setFiltroTipo(f)}
            >
              <Text style={[s.filterPillText, { color: filtroTipo === f ? '#fff' : colors.textSecondary }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action buttons */}
        <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>EXPORTAR</Text>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: isLoading ? colors.border : colors.primary }]}
          onPress={handleCompartir}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Icon name="share-2" size={18} color={isLoading ? colors.textTertiary : '#fff'} />
          <Text style={[s.actionBtnText, { color: isLoading ? colors.textTertiary : '#fff' }]}>
            Generar y compartir
          </Text>
        </TouchableOpacity>

        <View style={s.secondaryBtns}>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleGuardar}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Icon name="download" size={16} color={colors.primary} />
            <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Guardar local</Text>
          </TouchableOpacity>

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleImprimir}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Icon name="printer" size={16} color={colors.primary} />
              <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Imprimir</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Saved reports */}
        {guardados.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.textTertiary, marginTop: 8 }]}>REPORTES GUARDADOS</Text>
            <View style={[s.savedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {guardados.map((r, i) => (
                <View
                  key={r.uri}
                  style={[s.savedRow, i < guardados.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <View style={[s.savedIcon, { backgroundColor: colors.primaryLight }]}>
                    <Icon name="file-text" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.savedName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {r.nombre}
                    </Text>
                    <Text style={[s.savedMeta, { color: colors.textTertiary }]}>
                      {formatFecha(r.fecha)} · {formatSize(r.size)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => compartirReporteGuardado(r.uri).catch(() => {})}
                    style={[s.savedAction, { backgroundColor: colors.inputBg }]}
                  >
                    <Icon name="share-2" size={14} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEliminar(r)}
                    style={[s.savedAction, { backgroundColor: colors.inputBg, marginLeft: 6 }]}
                  >
                    <Icon name="trash-2" size={14} color={colors.expense} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },

  scroll: { padding: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.7,
    marginTop: 20, marginBottom: 10,
  },

  // Progress
  progressWrap: {
    borderRadius: THEME.radius.lg, padding: 16, marginBottom: 4,
    borderWidth: 1,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3 },

  // Month pills
  monthScroll: { marginBottom: 4 },
  monthScrollContent: { gap: 8, paddingRight: 8 },
  monthPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: THEME.radius.pill,
  },
  monthPillText: { fontSize: 13, fontWeight: '600' },

  // Stats card
  statsCard: {
    borderRadius: THEME.radius.lg, borderWidth: 1,
    padding: 16, marginBottom: 4,
  },
  statsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLbl: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32 },
  statsTxCount: { fontSize: 12, textAlign: 'center' },

  // Toggles
  togglesCard: {
    borderRadius: THEME.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  toggleIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Filter pills
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: THEME.radius.pill },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  // Action buttons
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: THEME.radius.lg,
    marginTop: 4,
  },
  actionBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: THEME.radius.lg, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },

  // Saved
  savedCard: { borderRadius: THEME.radius.lg, borderWidth: 1, overflow: 'hidden' },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  savedIcon: {
    width: 36, height: 36, borderRadius: THEME.radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  savedName: { fontSize: 13, fontWeight: '600' },
  savedMeta: { fontSize: 11, marginTop: 2 },
  savedAction: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
});
