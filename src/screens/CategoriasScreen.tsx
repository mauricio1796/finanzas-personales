import React, {
  useState, useMemo, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Animated, Alert, Modal, KeyboardAvoidingView,
  Platform, NativeSyntheticEvent, NativeScrollEvent, FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { calcularMetricasFinancieras } from '../utils/ingresoUtils';
import { reprogramarTodasLasNotificaciones } from '../services/NotificacionesService';
import { CATALOGO_CATEGORIAS, catalogoItemToCategory, getPaletaItem } from '../constants/catalogoCategorias';
import { Category, Transaction } from '../types';
import {
  getGastoTotalMes,
  getPresupuestoTotal,
  getEstadoCategoria,
  getColorEstado,
  getIconoCategoria,
  getBgIconoCategoria,
  generarIdCategoria,
  getLabelEstado,
  type EstadoCategoria,
} from '../utils/categoryUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

type FiltroTab = 'todas' | 'gastos' | 'ingresos' | 'pendientes' | 'pagadas';
type OrdenType = 'gasto' | 'presupuesto' | 'nombre';

const ICONOS_DISPONIBLES = [
  'shopping-cart', 'map-pin', 'home', 'heart', 'book-open', 'tv',
  'shopping-bag', 'zap', 'activity', 'feather', 'dollar-sign', 'tag',
  'coffee', 'music', 'camera', 'gift', 'truck', 'globe',
  'briefcase', 'phone', 'credit-card', 'more-horizontal',
];

// ── CategoriaCard ─────────────────────────────────────────────────────────────
interface CategoriaCardProps {
  categoria: Category & { gastado: number; pct: number; estado: EstadoCategoria };
  txCount: number;
  expandida: boolean;
  onToggleExpand: () => void;
  onPagar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  colors: any;
  isDark: boolean;
}

const CategoriaCard: React.FC<CategoriaCardProps> = React.memo(({
  categoria, txCount, expandida, onToggleExpand,
  onPagar, onEditar, onEliminar, colors, isDark,
}) => {
  const expandAnim = useRef(new Animated.Value(0)).current;
  const barAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expandida ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [expandida]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: Math.min(categoria.pct, 100) / 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [categoria.pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const { bg: iconBg, color: iconColor } = getBgIconoCategoria(categoria.name, isDark);
  const iconName = (categoria.icon as any) || getIconoCategoria(categoria.name);
  const estadoColor = getColorEstado(categoria.estado, colors);
  const budget = categoria.budget ?? 0;

  const borderColor =
    categoria.estado === 'paid'    ? colors.income  :
    categoria.estado === 'over'    ? colors.expense  :
    categoria.estado === 'warning' ? colors.warning  :
    colors.border;

  const subtitulo = categoria.pagado
    ? `Pagado este mes`
    : categoria.diaPago && !categoria.pagado
    ? `Día de pago: ${categoria.diaPago}`
    : categoria.estado === 'no_budget'
    ? 'Sin presupuesto asignado'
    : categoria.estado === 'over'
    ? 'Excedido este mes'
    : `${txCount} transacción${txCount !== 1 ? 'es' : ''} este mes`;

  const subtituloColor =
    categoria.pagado                    ? colors.income   :
    categoria.estado === 'over'         ? colors.expense  :
    categoria.estado === 'no_budget'    ? colors.primary  :
    colors.textTertiary;

  const ACCIONES = [
    { label: 'Editar',   icon: 'edit-2',  bg: colors.cardSecondary, color: colors.textSecondary, onPress: onEditar  },
    { label: 'Ajustar',  icon: 'sliders', bg: colors.primaryLight,  color: colors.primary,       onPress: onEditar  },
    { label: 'Pagar',    icon: 'check',   bg: colors.incomeLight,   color: colors.income,        onPress: onPagar,  hide: categoria.pagado },
    { label: 'Eliminar', icon: 'trash-2', bg: colors.expenseLight,  color: colors.expense,       onPress: onEliminar },
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggleExpand();
      }}
      style={[s.card, { backgroundColor: colors.card, borderColor }]}
    >
      {/* Main row */}
      <View style={s.cardMain}>
        <View style={[s.catIcon, { backgroundColor: iconBg }]}>
          <Icon name={iconName} size={16} color={iconColor} />
        </View>

        <View style={s.cardInfo}>
          <Text style={[s.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
            {categoria.name}
          </Text>
          <Text style={[s.cardSub, { color: subtituloColor }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        </View>

        <View style={s.cardRight}>
          <Text style={[s.cardGastado, { color: estadoColor }]}>
            {fmtCOP(categoria.gastado)}
          </Text>
          {budget > 0 && (
            <Text style={[s.cardBudget, { color: colors.textTertiary }]}>
              de {fmtCOP(budget)}
            </Text>
          )}
        </View>

        <Icon
          name={expandida ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textTertiary}
        />
      </View>

      {/* Progress bar */}
      {budget > 0 && (
        <View style={[s.barTrack, { backgroundColor: colors.borderSubtle }]}>
          <Animated.View
            style={[
              s.barFill,
              {
                backgroundColor: estadoColor,
                width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
      )}

      {/* Footer row */}
      <View style={s.cardFooter}>
        <Text style={[s.estadoLabel, { color: estadoColor }]}>
          {getLabelEstado(categoria.estado, categoria.pct)}
        </Text>
        <View style={s.footerActions}>
          {categoria.estado === 'no_budget' && (
            <TouchableOpacity onPress={onEditar} style={[s.footerBtn, { backgroundColor: colors.primaryLight }]}>
              <Icon name="plus" size={11} color={colors.primary} />
              <Text style={[s.footerBtnText, { color: colors.primary }]}>Asignar</Text>
            </TouchableOpacity>
          )}
          {categoria.estado === 'paid' && (
            <View style={[s.paidBadge, { backgroundColor: colors.incomeLight }]}>
              <Icon name="check" size={11} color={colors.income} />
              <Text style={[s.footerBtnText, { color: colors.income }]}>Pagado</Text>
            </View>
          )}
          {(categoria.estado === 'ok' || categoria.estado === 'warning' || categoria.estado === 'over') && (
            <>
              {categoria.diaPago && (
                <TouchableOpacity
                  onPress={onPagar}
                  style={[s.footerBtn, { backgroundColor: colors.incomeLight }]}
                >
                  <Icon name="check-circle" size={11} color={colors.income} />
                  <Text style={[s.footerBtnText, { color: colors.income }]}>Pagar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onEditar}>
                <Icon name="edit-2" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Expanded panel */}
      <Animated.View
        style={[
          s.expandPanel,
          {
            height: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }),
            borderTopColor: colors.borderSubtle,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={s.accionesRow}>
          {ACCIONES.filter(a => !a.hide).map(a => (
            <TouchableOpacity
              key={a.label}
              style={[s.accionBtn, { backgroundColor: a.bg }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                a.onPress();
              }}
            >
              <Icon name={a.icon as any} size={14} color={a.color} />
              <Text style={[s.accionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── CategoriasScreen ──────────────────────────────────────────────────────────
interface Props {
  onNavigate: (screen: string) => void;
}

export const CategoriasScreen: React.FC<Props> = ({ onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const {
    transactions, categories, profile,
    updateCategory, addCategory, deleteCategory, markCategoryPaid,
  } = useFinance();

  // ── State ──────────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const mesActual  = now.getMonth();
  const añoActual  = now.getFullYear();

  const [filtro, setFiltro] = useState<FiltroTab>('todas');
  const [orden, setOrden] = useState<OrdenType>('gasto');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  // Modales
  const [modalFormVisible, setModalFormVisible] = useState(false);
  const [modalEditar, setModalEditar] = useState<Category | null>(null);
  const [modalPagar, setModalPagar] = useState<Category | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formTipo, setFormTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [formPresupuesto, setFormPresupuesto] = useState('');
  const [formDiaPago, setFormDiaPago] = useState('');
  const [formIcono, setFormIcono] = useState('tag');
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Pay modal
  const [montoPago, setMontoPago] = useState('');

  // Catalog modal
  const [modalCatalogo, setModalCatalogo] = useState(false);
  const [seleccionNueva, setSeleccionNueva] = useState<Set<string>>(new Set());
  const [filtroCatalogo, setFiltroCatalogo] = useState<'todos' | 'esenciales' | 'gastos' | 'ingresos'>('todos');

  // Animations
  const searchAnim = useRef(new Animated.Value(0)).current;
  const fabAnim    = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const gastosPorCategoria = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mesActual && d.getFullYear() === añoActual;
      })
      .forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return result;
  }, [transactions, mesActual, añoActual]);

  const txCountPorCategoria = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === mesActual && d.getFullYear() === añoActual;
      })
      .forEach(t => { result[t.category] = (result[t.category] || 0) + 1; });
    return result;
  }, [transactions, mesActual, añoActual]);

  const categoriasEnriquecidas = useMemo(() => {
    return categories
      .filter(c => c.isSelected)
      .map(c => {
        const gastado = gastosPorCategoria[c.name] ?? 0;
        const budget = c.budget ?? 0;
        const pct = budget > 0 ? Math.round((gastado / budget) * 100) : 0;
        const estado = getEstadoCategoria(gastado, budget, c.pagado ?? false);
        return { ...c, gastado, pct, estado };
      });
  }, [categories, gastosPorCategoria]);

  const categoriasFiltradas = useMemo(() => {
    let result = [...categoriasEnriquecidas];
    switch (filtro) {
      case 'gastos':     result = result.filter(c => c.tipo === 'gasto' || c.tipo === 'variable'); break;
      case 'ingresos':   result = result.filter(c => c.tipo === 'ingreso'); break;
      case 'pendientes': result = result.filter(c => !(c.pagado) && c.diaPago && (c.tipo === 'gasto' || c.tipo === 'variable' || c.tipo === 'fijo')); break;
      case 'pagadas':    result = result.filter(c => c.pagado); break;
    }
    if (busqueda.trim()) {
      result = result.filter(c => c.name.toLowerCase().includes(busqueda.toLowerCase()));
    }
    switch (orden) {
      case 'gasto':       result.sort((a, b) => b.gastado - a.gastado); break;
      case 'presupuesto': result.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)); break;
      case 'nombre':      result.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return result;
  }, [categoriasEnriquecidas, filtro, busqueda, orden]);

  const categoriasGasto   = useMemo(() => categoriasFiltradas.filter(c => c.tipo === 'gasto' || c.tipo === 'variable' || c.tipo === 'fijo'), [categoriasFiltradas]);
  const categoriasIngreso = useMemo(() => categoriasFiltradas.filter(c => c.tipo === 'ingreso'), [categoriasFiltradas]);
  const categoriasOtras   = useMemo(() => categoriasFiltradas.filter(c => !c.tipo), [categoriasFiltradas]);

  const metricasIngreso  = useMemo(
    () => calcularMetricasFinancieras(transactions, categories as any, profile?.monthlySalary ?? 0, mesActual, añoActual),
    [transactions, categories, profile?.monthlySalary, mesActual, añoActual],
  );
  const gastoTotal       = metricasIngreso.totalGastado;
  const presupuestoTotal = metricasIngreso.ingresoEfectivo;
  const disponibleTotal  = metricasIngreso.balanceFinal;
  const pctTotal         = metricasIngreso.porcentajeGastado;

  const FILTROS = useMemo(() => [
    { key: 'todas'      as FiltroTab, label: 'Todas',      count: categoriasEnriquecidas.length },
    { key: 'gastos'     as FiltroTab, label: 'Gastos',     count: categoriasEnriquecidas.filter(c => c.tipo === 'gasto' || c.tipo === 'variable' || c.tipo === 'fijo').length },
    { key: 'ingresos'   as FiltroTab, label: 'Ingresos',   count: categoriasEnriquecidas.filter(c => c.tipo === 'ingreso').length },
    { key: 'pendientes' as FiltroTab, label: 'Pendientes', count: categoriasEnriquecidas.filter(c => !(c.pagado) && c.diaPago).length },
    { key: 'pagadas'    as FiltroTab, label: 'Pagadas',    count: categoriasEnriquecidas.filter(c => c.pagado).length },
  ], [categoriasEnriquecidas]);

  // ── Catalog memos ──────────────────────────────────────────────────────────
  const nombresActivos = useMemo(
    () => new Set(categories.filter((c: any) => c.isSelected).map((c: any) => c.name)),
    [categories],
  );

  const catalogoFiltrado = useMemo(() =>
    CATALOGO_CATEGORIAS.filter(item => {
      if (filtroCatalogo === 'esenciales') return item.esencial;
      if (filtroCatalogo === 'gastos')     return item.tipo === 'gasto';
      if (filtroCatalogo === 'ingresos')   return item.tipo === 'ingreso';
      return true;
    }),
  [filtroCatalogo]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleBusqueda = useCallback(() => {
    const toVal = mostrarBusqueda ? 0 : 1;
    setMostrarBusqueda(!mostrarBusqueda);
    if (mostrarBusqueda) setBusqueda('');
    Animated.timing(searchAnim, { toValue: toVal, duration: 200, useNativeDriver: false }).start();
  }, [mostrarBusqueda, searchAnim]);

  const ciclarOrden = useCallback(() => {
    setOrden(prev => prev === 'gasto' ? 'presupuesto' : prev === 'presupuesto' ? 'nombre' : 'gasto');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > lastScrollY.current + 10) {
      Animated.timing(fabAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else if (y < lastScrollY.current - 10) {
      Animated.timing(fabAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    lastScrollY.current = y;
  }, [fabAnim]);

  const abrirAgregar = useCallback(() => {
    setModalEditar(null);
    setFormNombre('');
    setFormTipo('gasto');
    setFormPresupuesto('');
    setFormDiaPago('');
    setFormIcono('tag');
    setErrores({});
    setModalFormVisible(true);
  }, []);

  const abrirEditar = useCallback((cat: Category) => {
    setModalEditar(cat);
    setFormNombre(cat.name);
    setFormTipo((cat.tipo as 'gasto' | 'ingreso') || 'gasto');
    setFormPresupuesto(cat.budget ? String(Math.round(cat.budget)) : '');
    setFormDiaPago(cat.diaPago ? String(cat.diaPago) : '');
    setFormIcono(cat.icon || 'tag');
    setErrores({});
    setModalFormVisible(true);
  }, []);

  const abrirPagar = useCallback((cat: Category) => {
    setModalPagar(cat);
    setMontoPago(cat.budget ? String(Math.round(cat.budget)) : '');
  }, []);

  const validarFormulario = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    const nombre = formNombre.trim();
    if (!nombre) errs.nombre = 'El nombre es requerido';
    else if (nombre.length < 2) errs.nombre = 'Mínimo 2 caracteres';
    else {
      const duplicado = categories.find(
        c => c.name.toLowerCase() === nombre.toLowerCase() && c.id !== modalEditar?.id
      );
      if (duplicado) errs.nombre = 'Ya existe una categoría con este nombre';
    }
    if (formDiaPago) {
      const n = parseInt(formDiaPago);
      if (isNaN(n) || n < 1 || n > 31) errs.diaPago = 'Día inválido (1-31)';
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  }, [formNombre, formDiaPago, categories, modalEditar]);

  const guardarCategoria = useCallback(() => {
    if (!validarFormulario()) return;
    const presupuesto = parseFloat(formPresupuesto.replace(/\./g, '').replace(',', '.')) || 0;
    const diaPago = formDiaPago ? parseInt(formDiaPago) : undefined;

    if (modalEditar) {
      updateCategory(modalEditar.id, {
        name: formNombre.trim(),
        tipo: formTipo,
        budget: presupuesto,
        diaPago,
        icon: formIcono,
      });
    } else {
      const nueva: Category = {
        id: generarIdCategoria(),
        name: formNombre.trim(),
        tipo: formTipo,
        budget: presupuesto,
        diaPago,
        icon: formIcono,
        isSelected: true,
        pagado: false,
        fechaCreacion: new Date().toISOString(),
      };
      addCategory(nueva);
    }

    reprogramarTodasLasNotificaciones(categories).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setModalFormVisible(false);
    setModalEditar(null);
  }, [validarFormulario, formPresupuesto, formDiaPago, formNombre, formTipo, formIcono, modalEditar, updateCategory, addCategory, categories]);

  const confirmarPago = useCallback(() => {
    if (!modalPagar) return;
    // markCategoryPaid handles: marking paid, adding transaction, adding XP
    markCategoryPaid(modalPagar.id);
    reprogramarTodasLasNotificaciones(
      categories.map(c => c.id === modalPagar.id ? { ...c, pagado: true } : c)
    ).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setModalPagar(null);
    setMontoPago('');
  }, [modalPagar, markCategoryPaid, categories]);

  const confirmarEliminar = useCallback((cat: Category) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Seguro que quieres eliminar "${cat.name}"? Las transacciones asociadas no se eliminarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteCategory(cat.id);
            reprogramarTodasLasNotificaciones(categories.filter(c => c.id !== cat.id)).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          },
        },
      ]
    );
  }, [deleteCategory, categories]);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderSectionHeader = (tipo: string, lista: any[]) => (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>
        {tipo === 'gasto' ? 'GASTOS' : tipo === 'ingreso' ? 'INGRESOS' : 'CATEGORÍAS'} · {lista.length} {lista.length === 1 ? 'CATEGORÍA' : 'CATEGORÍAS'}
      </Text>
      <TouchableOpacity onPress={abrirAgregar} style={s.newBtn}>
        <Icon name="plus" size={12} color={colors.primary} />
        <Text style={[s.newBtnText, { color: colors.primary }]}>Nueva</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCard = (cat: any) => (
    <CategoriaCard
      key={cat.id}
      categoria={cat}
      txCount={txCountPorCategoria[cat.name] ?? 0}
      expandida={expandidaId === cat.id}
      onToggleExpand={() => setExpandidaId(prev => prev === cat.id ? null : cat.id)}
      onPagar={() => abrirPagar(cat)}
      onEditar={() => abrirEditar(cat)}
      onEliminar={() => confirmarEliminar(cat)}
      colors={colors}
      isDark={isDark}
    />
  );

  // ── Form modal content ─────────────────────────────────────────────────────
  const renderForm = () => (
    <Modal
      visible={modalFormVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => { setModalFormVisible(false); setModalEditar(null); }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[s.modalContent, { paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Modal header */}
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
              {modalEditar ? `Editar ${modalEditar.name}` : 'Nueva categoría'}
            </Text>
            <TouchableOpacity
              onPress={() => { setModalFormVisible(false); setModalEditar(null); }}
              style={[s.closeBtn, { backgroundColor: colors.cardSecondary }]}
            >
              <Icon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Nombre */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>NOMBRE</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.inputBg, borderColor: errores.nombre ? colors.expense : colors.border }]}>
              <TextInput
                value={formNombre}
                onChangeText={t => { setFormNombre(t); if (errores.nombre) setErrores(p => ({...p, nombre: ''})); }}
                placeholder="ej. Alimentación"
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { color: colors.textPrimary }]}
                maxLength={30}
                autoFocus={!modalEditar}
              />
              <Text style={[s.charCount, { color: colors.textTertiary }]}>{formNombre.length}/30</Text>
            </View>
            {errores.nombre ? <Text style={[s.errorText, { color: colors.expense }]}>{errores.nombre}</Text> : null}
          </View>

          {/* Tipo */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>TIPO</Text>
            <View style={s.tipoRow}>
              {(['gasto', 'ingreso'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.tipoPill,
                    formTipo === t
                      ? { backgroundColor: t === 'gasto' ? colors.expenseLight : colors.incomeLight, borderColor: t === 'gasto' ? colors.expense : colors.income }
                      : { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                  ]}
                  onPress={() => setFormTipo(t)}
                >
                  <Icon
                    name={t === 'gasto' ? 'arrow-down' : 'arrow-up'}
                    size={14}
                    color={formTipo === t ? (t === 'gasto' ? colors.expense : colors.income) : colors.textTertiary}
                  />
                  <Text style={[
                    s.tipoPillText,
                    { color: formTipo === t ? (t === 'gasto' ? colors.expense : colors.income) : colors.textSecondary, fontWeight: formTipo === t ? '500' : '400' },
                  ]}>
                    {t === 'gasto' ? 'Gasto' : 'Ingreso'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Presupuesto */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>PRESUPUESTO MENSUAL</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[s.inputPrefix, { color: colors.textTertiary }]}>$</Text>
              <TextInput
                value={formPresupuesto}
                onChangeText={setFormPresupuesto}
                placeholder="0 = sin límite"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={[s.input, { color: colors.textPrimary }]}
              />
            </View>
          </View>

          {/* Día de pago (solo gastos) */}
          {formTipo === 'gasto' && (
            <View style={s.fieldGroup}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>DÍA DE PAGO (OPCIONAL)</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.inputBg, borderColor: errores.diaPago ? colors.expense : colors.border }]}>
                <TextInput
                  value={formDiaPago}
                  onChangeText={t => { setFormDiaPago(t); if (errores.diaPago) setErrores(p => ({...p, diaPago: ''})); }}
                  placeholder="1–31"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  style={[s.input, { color: colors.textPrimary }]}
                  maxLength={2}
                />
              </View>
              {errores.diaPago ? <Text style={[s.errorText, { color: colors.expense }]}>{errores.diaPago}</Text> : null}
            </View>
          )}

          {/* Icono */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>ÍCONO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.iconGrid}>
              {ICONOS_DISPONIBLES.map(ic => {
                const active = formIcono === ic;
                return (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      s.iconOption,
                      active
                        ? { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 }
                        : { backgroundColor: colors.cardSecondary, borderColor: colors.border, borderWidth: 0.5 },
                    ]}
                    onPress={() => setFormIcono(ic)}
                  >
                    <Icon name={ic as any} size={18} color={active ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: formNombre.trim() ? colors.primary : colors.borderSubtle }]}
            onPress={guardarCategoria}
            disabled={!formNombre.trim()}
          >
            <Text style={[s.saveBtnText, { color: formNombre.trim() ? '#FFFFFF' : colors.textTertiary }]}>
              {modalEditar ? 'Actualizar' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Pay modal ──────────────────────────────────────────────────────────────
  const renderPayModal = () => {
    if (!modalPagar) return null;
    const budget = modalPagar.budget ?? 0;
    const montoNum = parseFloat(montoPago.replace(/\./g, '').replace(',', '.')) || 0;
    const diferencia = montoNum - budget;
    const { bg: iconBg, color: iconColor } = getBgIconoCategoria(modalPagar.name, isDark);
    const iconName = (modalPagar.icon as any) || getIconoCategoria(modalPagar.name);

    return (
      <Modal
        visible={!!modalPagar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setModalPagar(null); setMontoPago(''); }}
      >
        <View style={[s.modalContent, { flex: 1, backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Confirmar pago</Text>
            <TouchableOpacity
              onPress={() => { setModalPagar(null); setMontoPago(''); }}
              style={[s.closeBtn, { backgroundColor: colors.cardSecondary }]}
            >
              <Icon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={s.payAvatarWrap}>
            <View style={[s.payAvatar, { backgroundColor: iconBg }]}>
              <Icon name={iconName} size={28} color={iconColor} />
            </View>
            <Text style={[s.payTitle, { color: colors.textPrimary }]}>{modalPagar.name}</Text>
            <Text style={[s.paySub, { color: colors.textSecondary }]}>
              Presupuesto asignado: {fmtCOP(budget)}
            </Text>
          </View>

          {/* Monto */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>MONTO PAGADO</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[s.inputPrefix, { color: colors.textTertiary, fontSize: 18 }]}>$</Text>
              <TextInput
                value={montoPago}
                onChangeText={setMontoPago}
                keyboardType="numeric"
                style={[s.input, { color: colors.textPrimary, fontSize: 22, fontWeight: '500' }]}
                placeholder={String(Math.round(budget))}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            {montoPago && budget > 0 && montoNum > 0 && (
              <Text style={[s.difText, { color: diferencia > 0 ? colors.expense : colors.income }]}>
                {diferencia > 0
                  ? `+${fmtCOP(diferencia)} sobre el presupuesto`
                  : `${fmtCOP(-diferencia)} bajo el presupuesto`}
              </Text>
            )}
          </View>

          <View style={s.payBtnRow}>
            <TouchableOpacity
              style={[s.payBtnCancel, { borderColor: colors.border }]}
              onPress={() => { setModalPagar(null); setMontoPago(''); }}
            >
              <Text style={[s.payBtnCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.payBtnConfirm, { backgroundColor: colors.primary }]}
              onPress={confirmarPago}
            >
              <Icon name="check" size={16} color="#FFFFFF" />
              <Text style={s.payBtnConfirmText}>Confirmar pago</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: colors.cardSecondary }]}>
        <Icon name="tag" size={28} color={colors.textTertiary} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
        {filtro === 'pendientes' ? 'Sin pagos pendientes' :
         filtro === 'pagadas'    ? 'Sin categorías pagadas' :
         busqueda                ? `Sin resultados para "${busqueda}"` :
         'Sin categorías aún'}
      </Text>
      <Text style={[s.emptySub, { color: colors.textSecondary }]}>
        {filtro === 'todas' && !busqueda
          ? 'Agrega tu primera categoría para empezar a controlar tus gastos'
          : 'Cambia el filtro para ver otras categorías'}
      </Text>
      {filtro === 'todas' && !busqueda && (
        <TouchableOpacity
          onPress={abrirAgregar}
          style={[s.emptyBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={s.emptyBtnText}>Agregar categoría</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 12 }]}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Categorías</Text>
          <View style={s.headerBtns}>
            <TouchableOpacity
              style={[s.headerBtn, s.headerBtnCatalog]}
              onPress={() => { setSeleccionNueva(new Set()); setModalCatalogo(true); }}
            >
              <Icon name="grid" size={13} color="#FFFFFF" />
              <Text style={s.headerBtnCatalogText}>Catálogo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={toggleBusqueda}>
              <Icon name={mostrarBusqueda ? 'x' : 'search'} size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={ciclarOrden}>
              <Icon name="sliders" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <Animated.View style={[s.searchWrap, { height: searchAnim.interpolate({ inputRange: [0,1], outputRange: [0,44] }), opacity: searchAnim, overflow: 'hidden', marginTop: searchAnim.interpolate({ inputRange:[0,1], outputRange:[0,12] }) }]}>
          <View style={s.searchInner}>
            <Icon name="search" size={14} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar categoría..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={s.searchInput}
              autoFocus={mostrarBusqueda}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Icon name="x" size={14} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Summary cards */}
        <View style={[s.summaryRow, { marginTop: mostrarBusqueda ? 4 : 16 }]}>
          {[
            { val: fmtCOP(gastoTotal),       label: 'Gastado',     color: '#FFFFFF' },
            { val: fmtCOP(disponibleTotal),  label: 'Disponible',  color: colors.income },
            { val: String(categoriasEnriquecidas.length), label: 'Categorías', color: '#FFFFFF' },
          ].map(m => (
            <View key={m.label} style={s.summaryCard}>
              <Text style={[s.summaryVal, { color: m.color }]} numberOfLines={1}>{m.val}</Text>
              <Text style={s.summaryLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Total budget bar */}
        <View style={s.budgetBarWrap}>
          <View style={s.budgetBarLabels}>
            <Text style={s.budgetBarLabel}>{metricasIngreso.esIngresoReal ? 'Ingreso registrado' : 'Salario estimado'}</Text>
            <Text style={s.budgetBarPct}>{pctTotal}%</Text>
          </View>
          <View style={s.budgetBarTrack}>
            <View style={[s.budgetBarFill, {
              width: `${Math.min(pctTotal, 100)}%` as any,
              backgroundColor: pctTotal >= 100 ? colors.expense : pctTotal >= 80 ? colors.warning : '#FFFFFF',
            }]} />
          </View>
          <View style={s.budgetBarLabels}>
            <Text style={s.budgetBarSub}>{fmtCOP(gastoTotal)} gastado</Text>
            <Text style={s.budgetBarSub}>de {fmtCOP(presupuestoTotal)}</Text>
          </View>
        </View>
      </View>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.filterScroll, { backgroundColor: colors.background }]}
        contentContainerStyle={s.filterContent}
      >
        {FILTROS.map(f => {
          const active = filtro === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                s.filterPill,
                active
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.cardSecondary, borderWidth: 0.5, borderColor: colors.border },
              ]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[s.filterPillText, { color: active ? '#FFFFFF' : colors.textSecondary, fontWeight: active ? '500' : '400' }]}>
                {f.label}
              </Text>
              {f.count > 0 && (
                <View style={[s.filterBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.primary }]}>
                  <Text style={s.filterBadgeText}>{f.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {categoriasFiltradas.length === 0 ? (
        <ScrollView contentContainerStyle={{ flex: 1 }}>{renderEmpty()}</ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {filtro === 'todas' ? (
            <>
              {categoriasGasto.length > 0 && (
                <>
                  {renderSectionHeader('gasto', categoriasGasto)}
                  {categoriasGasto.map(renderCard)}
                </>
              )}
              {categoriasIngreso.length > 0 && (
                <>
                  {renderSectionHeader('ingreso', categoriasIngreso)}
                  {categoriasIngreso.map(renderCard)}
                </>
              )}
              {categoriasOtras.length > 0 && (
                <>
                  {renderSectionHeader('otra', categoriasOtras)}
                  {categoriasOtras.map(renderCard)}
                </>
              )}
            </>
          ) : (
            <>
              {categoriasFiltradas.map(renderCard)}
            </>
          )}
        </ScrollView>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.fab, { bottom: insets.bottom + 80, opacity: fabAnim, transform: [{ scale: fabAnim }] }]}>
        <TouchableOpacity
          style={[s.fabBtn, { backgroundColor: colors.primary }]}
          onPress={abrirAgregar}
        >
          <Icon name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {renderForm()}
      {renderPayModal()}

      {/* ── Catalog modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={modalCatalogo}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalCatalogo(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={[s.catModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.catModalTitle, { color: colors.textPrimary }]}>
              Agregar categorías
            </Text>
            <TouchableOpacity onPress={() => setModalCatalogo(false)}>
              <Icon name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Filtros */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 48 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row' }}
          >
            {(['todos', 'esenciales', 'gastos', 'ingresos'] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFiltroCatalogo(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: filtroCatalogo === f ? colors.primary : colors.cardSecondary,
                  borderWidth: 0.5,
                  borderColor: filtroCatalogo === f ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '500', color: filtroCatalogo === f ? '#fff' : colors.textSecondary }}>
                  {f === 'todos' ? 'Todos' : f === 'esenciales' ? 'Esenciales' : f === 'gastos' ? 'Gastos' : 'Ingresos'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Contador */}
          {seleccionNueva.size > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500' }}>
                {seleccionNueva.size} categoría{seleccionNueva.size !== 1 ? 's' : ''} seleccionada{seleccionNueva.size !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Grid */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {catalogoFiltrado.map(item => {
                const estaActiva  = nombresActivos.has(item.nombre);
                const estaElegida = seleccionNueva.has(item.nombre);
                const paleta      = getPaletaItem(item.nombre, isDark);
                const CARD_SIZE   = (Dimensions.get('window').width - 32 - 20) / 3;

                return (
                  <TouchableOpacity
                    key={item.nombre}
                    onPress={() => {
                      if (estaActiva) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setSeleccionNueva(prev => {
                        const next = new Set(prev);
                        next.has(item.nombre) ? next.delete(item.nombre) : next.add(item.nombre);
                        return next;
                      });
                    }}
                    activeOpacity={estaActiva ? 1 : 0.8}
                    style={{
                      width: CARD_SIZE,
                      aspectRatio: 1,
                      borderRadius: 16,
                      borderWidth: estaElegida ? 1.5 : 0.5,
                      borderColor: estaActiva ? colors.border : estaElegida ? colors.primary : colors.border,
                      backgroundColor: estaActiva ? colors.cardSecondary : estaElegida ? colors.primaryLight : colors.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 8,
                      opacity: estaActiva ? 0.5 : 1,
                    }}
                  >
                    {/* Ícono */}
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: paleta.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}>
                      <Icon name={item.icono as any} size={18} color={estaElegida ? colors.primary : paleta.color} />
                    </View>

                    {/* Nombre */}
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '500',
                      color: estaActiva ? colors.textTertiary : estaElegida ? colors.primary : colors.textPrimary,
                      textAlign: 'center',
                    }} numberOfLines={2}>
                      {item.nombre}
                    </Text>

                    {/* Badge "Ya tienes" */}
                    {estaActiva && (
                      <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.incomeLight, borderRadius: 6, padding: 2 }}>
                        <Icon name="check" size={8} color={colors.income} />
                      </View>
                    )}

                    {/* Badge seleccionada */}
                    {estaElegida && !estaActiva && (
                      <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.primary, borderRadius: 6, padding: 2 }}>
                        <Icon name="check" size={8} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Crear personalizada */}
            <TouchableOpacity
              onPress={() => { setModalCatalogo(false); setTimeout(() => abrirAgregar(), 300); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                borderWidth: 0.5,
                borderColor: colors.border,
                borderStyle: 'dashed',
              }}
            >
              <Icon name="plus" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>
                Crear categoría personalizada
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Botón confirmar */}
          <View style={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}>
            <TouchableOpacity
              onPress={() => {
                seleccionNueva.forEach(nombre => {
                  const item = CATALOGO_CATEGORIAS.find(c => c.nombre === nombre);
                  if (!item) return;
                  const yaExiste = categories.some((c: any) => c.name === nombre);
                  if (yaExiste) {
                    const existente = categories.find((c: any) => c.name === nombre);
                    if (existente) updateCategory((existente as any).id, { isSelected: true });
                  } else {
                    const salario = (profile as any)?.monthlySalary || 0;
                    addCategory(catalogoItemToCategory(
                      item,
                      salario > 0 ? Math.round((salario * item.pctSugerido) / 10000 / 10000) * 10000 : 0,
                    ));
                  }
                });
                reprogramarTodasLasNotificaciones(categories as any).catch(() => {});
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setModalCatalogo(false);
                setSeleccionNueva(new Set());
              }}
              disabled={seleccionNueva.size === 0}
              style={{
                backgroundColor: seleccionNueva.size > 0 ? colors.primary : colors.cardSecondary,
                borderRadius: 14,
                padding: 15,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: seleccionNueva.size > 0 ? '#fff' : colors.textTertiary }}>
                {seleccionNueva.size > 0
                  ? `Agregar ${seleccionNueva.size} categoría${seleccionNueva.size !== 1 ? 's' : ''}`
                  : 'Selecciona categorías del catálogo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:  { fontSize: 18, fontWeight: '500', color: '#FFFFFF' },
  headerBtns:   { flexDirection: 'row', gap: 8 },
  headerBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerBtnCatalog:  { width: 'auto' as any, paddingHorizontal: 10, flexDirection: 'row', gap: 4 },
  headerBtnCatalogText: { fontSize: 12, fontWeight: '500', color: '#FFFFFF' },
  catModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 0.5 },
  catModalTitle:  { fontSize: 17, fontWeight: '500' },

  // Search
  searchWrap:  {},
  searchInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#FFFFFF', height: 40 },

  // Summary cards
  summaryRow:  { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  summaryVal:  { fontSize: 13, fontWeight: '500' },
  summaryLabel:{ fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  // Budget bar
  budgetBarWrap:   { marginTop: 12 },
  budgetBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  budgetBarLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  budgetBarPct:    { fontSize: 11, fontWeight: '500', color: '#FFFFFF' },
  budgetBarTrack:  { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  budgetBarFill:   { height: 4, borderRadius: 2 },
  budgetBarSub:    { fontSize: 10, color: 'rgba(255,255,255,0.55)' },

  // Filters
  filterScroll:  { maxHeight: 50, flexShrink: 0 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  filterPill:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, gap: 5 },
  filterPillText:{ fontSize: 12 },
  filterBadge:   { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  filterBadgeText: { fontSize: 9, fontWeight: '500', color: '#FFFFFF' },

  // List
  listContent: { paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  sectionLabel:  { fontSize: 11, fontWeight: '500', letterSpacing: 0.6 },
  newBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newBtnText:    { fontSize: 12 },

  // Card
  card:      { borderRadius: 14, borderWidth: 0.5, padding: 12, marginBottom: 8, gap: 8 },
  cardMain:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo:  { flex: 1, gap: 2 },
  cardName:  { fontSize: 14, fontWeight: '500' },
  cardSub:   { fontSize: 11 },
  cardRight: { alignItems: 'flex-end', gap: 1 },
  cardGastado: { fontSize: 14, fontWeight: '500' },
  cardBudget:  { fontSize: 11 },
  barTrack:    { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill:     { height: 5, borderRadius: 3 },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estadoLabel: { fontSize: 11 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  footerBtnText: { fontSize: 11, fontWeight: '500' },
  paidBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  expandPanel: { borderTopWidth: 0.5 },
  accionesRow: { flexDirection: 'row', gap: 6, paddingTop: 8 },
  accionBtn:   { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', gap: 4 },
  accionLabel: { fontSize: 11, fontWeight: '500' },

  // FAB
  fab:    { position: 'absolute', right: 16 },
  fabBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },

  // Modal
  modalContent: { padding: 20 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  modalTitle:   { flex: 1, fontSize: 17, fontWeight: '500' },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Form fields
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 8 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, gap: 6 },
  input:      { flex: 1, fontSize: 15, height: 48 },
  inputPrefix:{ fontSize: 15 },
  charCount:  { fontSize: 11 },
  errorText:  { fontSize: 11, marginTop: 4 },
  tipoRow:    { flexDirection: 'row', gap: 10 },
  tipoPill:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  tipoPillText: { fontSize: 14 },
  iconGrid:   { gap: 8, paddingRight: 4 },
  iconOption: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtn:    { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText:{ fontSize: 16, fontWeight: '500' },

  // Pay modal
  payAvatarWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  payAvatar:     { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  payTitle:      { fontSize: 16, fontWeight: '500' },
  paySub:        { fontSize: 13 },
  difText:       { fontSize: 11, marginTop: 4 },
  payBtnRow:     { flexDirection: 'row', gap: 12, marginTop: 24 },
  payBtnCancel:  { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  payBtnCancelText: { fontSize: 15 },
  payBtnConfirm: { flex: 2, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payBtnConfirmText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});
