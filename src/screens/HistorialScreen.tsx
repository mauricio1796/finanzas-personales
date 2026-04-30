import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { useHaptics } from '../hooks/useHaptics';
import { Toast, useToast } from '../components/ui/Toast';
import { useBottomPadding } from '../hooks/useBottomPadding';
import { getBgIconoCategoria } from '../utils/categoryUtils';
import {
  type FiltrosActivos,
  type TransaccionAgrupada,
  filtrarTransacciones,
  agruparPorFecha,
  calcularEstadisticasHistorial,
  getCategoriasFiltro,
  getIconoTx,
} from '../utils/historialUtils';
import { type Transaction } from '../types';
import { THEME } from '../constants/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCOP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

// ── FlatList item union ───────────────────────────────────────────────────────

type FlatItem =
  | { tipo: 'grupo_header'; data: TransaccionAgrupada }
  | { tipo: 'transaccion';  data: Transaction; grupo: TransaccionAgrupada }
  | { tipo: 'grupo_footer'; grupoFechaISO: string };

// ── Estado vacío (sub-componente puro) ───────────────────────────────────────

interface EmptyProps {
  filtros: FiltrosActivos;
  onLimpiar: () => void;
  colors: any;
}

const EstadoVacioHistorial: React.FC<EmptyProps> = ({ filtros, onLimpiar, colors }) => {
  const hayFiltros =
    filtros.tipo !== 'todos' ||
    filtros.periodo !== 'mes' ||
    filtros.categoria !== null ||
    filtros.busqueda !== '';
  return (
    <View style={ev.root}>
      <View style={[ev.iconWrap, { backgroundColor: colors.cardSecondary }]}>
        <Icon
          name={filtros.busqueda ? 'search' : 'inbox'}
          size={28}
          color={colors.textTertiary}
        />
      </View>
      <Text style={[ev.title, { color: colors.textPrimary }]}>
        {filtros.busqueda
          ? `Sin resultados para "${filtros.busqueda}"`
          : 'Sin transacciones'}
      </Text>
      <Text style={[ev.sub, { color: colors.textSecondary }]}>
        {hayFiltros
          ? 'Prueba ajustando los filtros'
          : 'Registra tu primera transaccion desde el Dashboard'}
      </Text>
      {hayFiltros && (
        <TouchableOpacity
          onPress={onLimpiar}
          style={[ev.btn, { backgroundColor: colors.primary }]}
        >
          <Text style={ev.btnText}>Limpiar filtros</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const ev = StyleSheet.create({
  root:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  sub:      { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  btn:      { borderRadius: THEME.radius.md, paddingHorizontal: 20, paddingVertical: 10 },
  btnText:  { fontSize: 13, fontWeight: '500', color: THEME.colors.surface },
});

// ── Filtros por defecto ───────────────────────────────────────────────────────

const FILTROS_DEFAULT: FiltrosActivos = {
  tipo:      'todos',
  orden:     'reciente',
  periodo:   'mes',
  categoria: null,
  busqueda:  '',
};

// ── Pantalla principal ────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export const HistorialScreen: React.FC<Props> = ({ onBack }) => {
  const { transactions, deleteTransaction } = useFinance();
  const { colors, isDark } = useTheme();
  const insets       = useSafeAreaInsets();
  const haptics      = useHaptics();
  const { toast, mostrar: mostrarToast, ocultar: ocultarToast } = useToast();
  const bottomPadding = useBottomPadding(24);

  // ── Estado local ─────────────────────────────────────────────────────────────
  const [filtros,             setFiltros]             = useState<FiltrosActivos>(FILTROS_DEFAULT);
  const [mostrarBusqueda,     setMostrarBusqueda]     = useState(false);
  const [mostrarFiltrosPanel, setMostrarFiltrosPanel] = useState(false);
  const [txSeleccionada,      setTxSeleccionada]      = useState<Transaction | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const listRef     = useRef<FlatList>(null);
  const lastScrollY = useRef(0);

  // ── Animaciones ───────────────────────────────────────────────────────────────
  const filtrosPanelAnim = useRef(new Animated.Value(0)).current;
  const headerAnim       = useRef(new Animated.Value(1)).current;

  // ── Datos derivados ───────────────────────────────────────────────────────────
  const txFiltradas = useMemo(
    () => filtrarTransacciones(transactions, filtros),
    [transactions, filtros],
  );

  const grupos = useMemo(
    () => agruparPorFecha(txFiltradas, filtros.orden),
    [txFiltradas, filtros.orden],
  );

  const estadisticas = useMemo(
    () => calcularEstadisticasHistorial(txFiltradas),
    [txFiltradas],
  );

  const categoriasDisponibles = useMemo(
    () => getCategoriasFiltro(transactions),
    [transactions],
  );

  const filtrosActivosCount = useMemo(() => {
    let n = 0;
    if (filtros.tipo !== 'todos')      n++;
    if (filtros.periodo !== 'mes')     n++;
    if (filtros.categoria !== null)    n++;
    if (filtros.orden !== 'reciente')  n++;
    return n;
  }, [filtros]);

  // ── FlatList data ─────────────────────────────────────────────────────────────
  const flatData = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    grupos.forEach(grupo => {
      items.push({ tipo: 'grupo_header', data: grupo });
      grupo.transacciones.forEach(tx => {
        items.push({ tipo: 'transaccion', data: tx, grupo });
      });
      items.push({ tipo: 'grupo_footer', grupoFechaISO: grupo.fechaISO });
    });
    return items;
  }, [grupos]);

  const stickyIndices = useMemo(
    () =>
      flatData.reduce((acc, item, i) => {
        if (item.tipo === 'grupo_header') acc.push(i);
        return acc;
      }, [] as number[]),
    [flatData],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_DEFAULT), []);

  const toggleFiltrosPanel = useCallback(() => {
    haptics.light();
    const next = mostrarFiltrosPanel ? 0 : 1;
    setMostrarFiltrosPanel(v => !v);
    Animated.timing(filtrosPanelAnim, {
      toValue: next,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [mostrarFiltrosPanel, filtrosPanelAnim, haptics]);

  const confirmarEliminar = useCallback(
    (tx: Transaction, onSuccess?: () => void) => {
      Alert.alert(
        'Eliminar transaccion',
        `Eliminar ${tx.type === 'income' ? 'ingreso' : 'gasto'} de ${formatCOP(tx.amount)}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              deleteTransaction(tx.id);
              haptics.success();
              mostrarToast('Transaccion eliminada', 'success');
              onSuccess?.();
            },
          },
        ],
      );
    },
    [deleteTransaction, haptics, mostrarToast],
  );

  // ── Render: grupo header (sticky) ─────────────────────────────────────────────
  const renderGrupoHeader = useCallback(
    (grupo: TransaccionAgrupada) => (
      <View
        style={[
          s.grupoHeader,
          { backgroundColor: colors.background, borderBottomColor: colors.borderSubtle },
        ]}
      >
        <View style={s.grupoLeft}>
          {grupo.esHoy && (
            <View style={[s.grupoDot, { backgroundColor: colors.primary }]} />
          )}
          <Text
            style={[
              s.grupoLabel,
              { color: grupo.esHoy ? colors.primary : colors.textSecondary },
            ]}
          >
            {grupo.fechaLabel.toUpperCase()}
          </Text>
          <Text style={[s.grupoCount, { color: colors.textTertiary }]}>
            · {grupo.transacciones.length} mov.
          </Text>
        </View>
        <View style={s.grupoTotales}>
          {grupo.totalIngresos > 0 && (
            <Text style={[s.grupoTotal, { color: colors.income }]}>
              +{formatCOP(grupo.totalIngresos)}
            </Text>
          )}
          {grupo.totalGastos > 0 && (
            <Text style={[s.grupoTotal, { color: colors.expense }]}>
              -{formatCOP(grupo.totalGastos)}
            </Text>
          )}
        </View>
      </View>
    ),
    [colors],
  );

  // ── Render: fila de transacción ───────────────────────────────────────────────
  const renderTransaccion = useCallback(
    (tx: Transaction) => {
      const isIncome = tx.type === 'income';
      const paleta   = getBgIconoCategoria(tx.category, isDark);
      const icono    = getIconoTx(tx.category, tx.type);
      const hora     = new Date(tx.date).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return (
        <SwipeableRow
          key={tx.id}
          onDelete={() => {
            haptics.heavy();
            confirmarEliminar(tx);
          }}
        >
          <TouchableOpacity
            onPress={() => { haptics.light(); setTxSeleccionada(tx); }}
            onLongPress={() => { haptics.medium(); setTxSeleccionada(tx); }}
            style={[
              s.txRow,
              { backgroundColor: colors.card, borderBottomColor: colors.borderSubtle },
            ]}
            activeOpacity={0.7}
          >
            {/* Ícono */}
            <View
              style={[
                s.txIcon,
                { backgroundColor: isIncome ? colors.incomeLight : paleta.bg },
              ]}
            >
              <Icon
                name={icono as any}
                size={18}
                color={isIncome ? colors.income : paleta.color}
              />
            </View>

            {/* Info */}
            <View style={s.txInfo}>
              <Text
                style={[s.txTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {tx.description || tx.category}
              </Text>
              <View style={s.txMeta}>
                <Text style={[s.txMetaTxt, { color: colors.textTertiary }]}>
                  {tx.category}
                </Text>
                <View style={[s.txMetaDot, { backgroundColor: colors.textTertiary }]} />
                <Text style={[s.txMetaTxt, { color: colors.textTertiary }]}>
                  {hora}
                </Text>
              </View>
            </View>

            {/* Monto */}
            <Text
              style={[
                s.txAmount,
                { color: isIncome ? colors.income : colors.expense },
              ]}
            >
              {isIncome ? '+' : '-'}{formatCOP(tx.amount)}
            </Text>
          </TouchableOpacity>
        </SwipeableRow>
      );
    },
    [colors, isDark, haptics, confirmarEliminar],
  );

  // ── Render: item del FlatList ─────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => {
      switch (item.tipo) {
        case 'grupo_header':
          return renderGrupoHeader(item.data);
        case 'transaccion':
          return renderTransaccion(item.data);
        case 'grupo_footer':
          return <View style={[s.grupoSpacer, { backgroundColor: colors.background }]} />;
      }
    },
    [renderGrupoHeader, renderTransaccion, colors],
  );

  const keyExtractor = useCallback(
    (item: FlatItem, i: number): string => {
      if (item.tipo === 'transaccion')   return item.data.id;
      if (item.tipo === 'grupo_header')  return `hdr_${item.data.fechaISO}`;
      return `ftr_${item.grupoFechaISO}_${i}`;
    },
    [],
  );

  // ── Render principal ──────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.header,
          {
            backgroundColor: colors.headerBg,
            paddingTop: insets.top + 12,
            opacity: headerAnim,
          },
        ]}
      >
        <View style={[s.headerRow, { marginBottom: mostrarBusqueda ? 12 : 0 }]}>
          {/* Atrás */}
          <TouchableOpacity
            onPress={() => { haptics.light(); onBack(); }}
            style={s.headerIconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={16} color={THEME.colors.surface} />
          </TouchableOpacity>

          {/* Título o barra de búsqueda */}
          {mostrarBusqueda ? (
            <View style={s.searchBar}>
              <Icon name="search" size={14} color="rgba(255,255,255,0.6)" />
              <TextInput
                autoFocus
                value={filtros.busqueda}
                onChangeText={q => setFiltros(f => ({ ...f, busqueda: q }))}
                placeholder="Buscar transacciones..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={s.searchInput}
                returnKeyType="search"
              />
              {filtros.busqueda.length > 0 && (
                <TouchableOpacity
                  onPress={() => setFiltros(f => ({ ...f, busqueda: '' }))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={s.headerTitle}>Historial</Text>
          )}

          {/* Acciones */}
          <View style={s.headerActions}>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                if (mostrarBusqueda) setFiltros(f => ({ ...f, busqueda: '' }));
                setMostrarBusqueda(v => !v);
              }}
              style={[s.headerIconBtn, mostrarBusqueda && s.headerIconBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={mostrarBusqueda ? 'x' : 'search'} size={15} color={THEME.colors.surface} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleFiltrosPanel}
              style={[s.headerIconBtn, filtrosActivosCount > 0 && s.headerIconBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="sliders" size={15} color={THEME.colors.surface} />
              {filtrosActivosCount > 0 && (
                <View
                  style={[
                    s.filterBadge,
                    { backgroundColor: colors.warning, borderColor: colors.headerBg },
                  ]}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── PANEL DE FILTROS ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.filtrosPanel,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            maxHeight: filtrosPanelAnim.interpolate({
              inputRange:  [0, 1],
              outputRange: [0, 280],
            }),
          },
        ]}
      >
        <View style={s.filtrosPanelInner}>

          {/* Tipo */}
          <View style={s.filtroGrupo}>
            <Text style={[s.filtroLabel, { color: colors.textTertiary }]}>TIPO</Text>
            <View style={s.filtroFila}>
              {(['todos', 'ingresos', 'gastos'] as const).map((key, i) => {
                const labels = ['Todos', 'Ingresos', 'Gastos'];
                const activo = filtros.tipo === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => { haptics.selection(); setFiltros(p => ({ ...p, tipo: key })); }}
                    style={[
                      s.pill,
                      {
                        backgroundColor: activo ? colors.primary : colors.cardSecondary,
                        borderColor:     activo ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[s.pillTxt, { color: activo ? THEME.colors.surface : colors.textSecondary }]}>
                      {labels[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Período */}
          <View style={s.filtroGrupo}>
            <Text style={[s.filtroLabel, { color: colors.textTertiary }]}>PERIODO</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filtroHScroll}
              contentContainerStyle={s.filtroHScrollContent}
            >
              {(
                [
                  { key: 'hoy',          label: 'Hoy'          },
                  { key: 'semana',       label: 'Esta semana'  },
                  { key: 'mes',          label: 'Este mes'     },
                  { key: 'mes_anterior', label: 'Mes anterior' },
                  { key: '3meses',       label: '3 meses'      },
                  { key: 'todo',         label: 'Todo'         },
                ] as const
              ).map(f => {
                const activo = filtros.periodo === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => { haptics.selection(); setFiltros(p => ({ ...p, periodo: f.key })); }}
                    style={[
                      s.pillSm,
                      {
                        backgroundColor: activo ? colors.primary : colors.cardSecondary,
                        borderColor:     activo ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[s.pillSmTxt, { color: activo ? THEME.colors.surface : colors.textSecondary }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Categoría */}
          {categoriasDisponibles.length > 0 && (
            <View style={s.filtroGrupo}>
              <Text style={[s.filtroLabel, { color: colors.textTertiary }]}>CATEGORIA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.filtroHScroll}
                contentContainerStyle={s.filtroHScrollContent}
              >
                <TouchableOpacity
                  onPress={() => { haptics.selection(); setFiltros(p => ({ ...p, categoria: null })); }}
                  style={[
                    s.pillSm,
                    {
                      backgroundColor: filtros.categoria === null ? colors.primary : colors.cardSecondary,
                      borderColor:     filtros.categoria === null ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[s.pillSmTxt, { color: filtros.categoria === null ? '#fff' : colors.textSecondary }]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {categoriasDisponibles.map(cat => {
                  const activo = filtros.categoria === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        haptics.selection();
                        setFiltros(p => ({ ...p, categoria: p.categoria === cat ? null : cat }));
                      }}
                      style={[
                        s.pillSm,
                        {
                          backgroundColor: activo ? colors.primary : colors.cardSecondary,
                          borderColor:     activo ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.pillSmTxt, { color: activo ? THEME.colors.surface : colors.textSecondary }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Orden + limpiar */}
          <View style={s.ordenFila}>
            <View style={[s.filtroFila, { flex: 1, flexWrap: 'wrap' }]}>
              {(
                [
                  { key: 'reciente', label: 'Reciente', icon: 'arrow-down'   },
                  { key: 'antiguo',  label: 'Antiguo',  icon: 'arrow-up'     },
                  { key: 'mayor',    label: 'Mayor',    icon: 'chevrons-down' },
                  { key: 'menor',    label: 'Menor',    icon: 'chevrons-up'  },
                ] as const
              ).map(f => {
                const activo = filtros.orden === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => { haptics.selection(); setFiltros(p => ({ ...p, orden: f.key })); }}
                    style={[
                      s.ordenPill,
                      {
                        backgroundColor: activo ? colors.primaryLight : colors.cardSecondary,
                        borderColor:     activo ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Icon
                      name={f.icon as any}
                      size={11}
                      color={activo ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[s.ordenTxt, { color: activo ? colors.primary : colors.textSecondary }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {filtrosActivosCount > 0 && (
              <TouchableOpacity onPress={limpiarFiltros}>
                <Text style={[s.limpiarTxt, { color: colors.expense }]}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </Animated.View>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <View
        style={[
          s.statsStrip,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        {[
          { label: 'Movimientos', value: String(estadisticas.totalTransacciones), color: colors.textPrimary },
          { label: 'Ingresos',    value: formatCOP(estadisticas.totalIngresos),   color: colors.income     },
          { label: 'Gastos',      value: formatCOP(estadisticas.totalGastos),     color: colors.expense    },
          {
            label: 'Balance',
            value: formatCOP(estadisticas.balance),
            color: estadisticas.balance >= 0 ? colors.income : colors.expense,
          },
        ].map((stat, i) => (
          <View
            key={stat.label}
            style={[
              s.statCell,
              i < 3 && { borderRightWidth: 0.5, borderRightColor: colors.borderSubtle },
            ]}
          >
            <Text
              style={[s.statVal, { color: stat.color }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {stat.value}
            </Text>
            <Text style={[s.statLbl, { color: colors.textTertiary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── LISTA ───────────────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        stickyHeaderIndices={stickyIndices}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.listContent, { paddingBottom: bottomPadding }]}
        ListEmptyComponent={
          <EstadoVacioHistorial
            filtros={filtros}
            onLimpiar={limpiarFiltros}
            colors={colors}
          />
        }
        onScroll={e => {
          const y = e.nativeEvent.contentOffset.y;
          if (y > lastScrollY.current + 20) {
            Animated.timing(headerAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }).start();
          } else if (y < lastScrollY.current - 10) {
            Animated.timing(headerAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
          }
          lastScrollY.current = y;
        }}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: 65, offset: 65 * index, index })}
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={10}
      />

      {/* ── MODAL DETALLE ────────────────────────────────────────────────────── */}
      {txSeleccionada && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setTxSeleccionada(null)}
        >
          <View style={[s.modalRoot, { backgroundColor: colors.background }]}>
            {/* Handle */}
            <View style={s.modalHandleWrap}>
              <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            </View>

            {/* Header */}
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalHeaderTitle, { color: colors.textPrimary }]}>Detalle</Text>
              <TouchableOpacity
                onPress={() => setTxSeleccionada(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={s.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Monto grande */}
              <View style={s.modalAmountWrap}>
                <View
                  style={[
                    s.modalAmountIcon,
                    {
                      backgroundColor:
                        txSeleccionada.type === 'income'
                          ? colors.incomeLight
                          : colors.expenseLight,
                    },
                  ]}
                >
                  <Icon
                    name={getIconoTx(txSeleccionada.category, txSeleccionada.type) as any}
                    size={28}
                    color={txSeleccionada.type === 'income' ? colors.income : colors.expense}
                  />
                </View>
                <Text
                  style={[
                    s.modalAmount,
                    { color: txSeleccionada.type === 'income' ? colors.income : colors.expense },
                  ]}
                >
                  {txSeleccionada.type === 'income' ? '+' : '-'}
                  {formatCOP(txSeleccionada.amount)}
                </Text>
                <Text style={[s.modalAmountSub, { color: colors.textSecondary }]}>
                  {txSeleccionada.type === 'income' ? 'Ingreso' : 'Gasto'} · {txSeleccionada.category}
                </Text>
              </View>

              {/* Tabla de datos */}
              {[
                { label: 'Categoria', value: txSeleccionada.category },
                {
                  label: 'Fecha',
                  value: new Date(txSeleccionada.date).toLocaleDateString('es-CO', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                },
                {
                  label: 'Hora',
                  value: new Date(txSeleccionada.date).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
                ...(txSeleccionada.description
                  ? [{ label: 'Descripcion', value: txSeleccionada.description }]
                  : []),
                { label: 'ID', value: txSeleccionada.id },
              ].map((row, i) => (
                <View
                  key={i}
                  style={[s.modalRow, { borderBottomColor: colors.borderSubtle }]}
                >
                  <Text style={[s.modalRowLabel, { color: colors.textSecondary }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[s.modalRowValue, { color: colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}

              {/* Botón eliminar */}
              <TouchableOpacity
                onPress={() => {
                  haptics.heavy();
                  confirmarEliminar(txSeleccionada, () => setTxSeleccionada(null));
                }}
                style={[s.modalDeleteBtn, { borderColor: colors.expense }]}
              >
                <Icon name="trash-2" size={16} color={colors.expense} />
                <Text style={[s.modalDeleteTxt, { color: colors.expense }]}>
                  Eliminar transaccion
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ── TOAST ───────────────────────────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        mensaje={toast.mensaje}
        tipo={toast.tipo}
        onHide={ocultarToast}
      />
    </View>
  );
};

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: THEME.colors.surface,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: THEME.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.surface,
    height: 38,
    padding: 0,
  },

  // Filtros panel
  filtrosPanel: {
    overflow: 'hidden',
    borderBottomWidth: 0.5,
  },
  filtrosPanelInner: {
    padding: 16,
    gap: 12,
  },
  filtroGrupo: { gap: 6 },
  filtroLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.6 },
  filtroFila:  { flexDirection: 'row', gap: 6 },
  filtroHScroll: { marginHorizontal: -16 },
  filtroHScrollContent: { paddingHorizontal: 16, flexDirection: 'row', gap: 6 },

  // Pills
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  pillTxt:   { fontSize: 12, fontWeight: '500' },
  pillSm:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5 },
  pillSmTxt: { fontSize: 11, fontWeight: '500' },

  // Orden
  ordenFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ordenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5 },
  ordenTxt:  { fontSize: 11, fontWeight: '500' },
  limpiarTxt:{ fontSize: 12 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 13, fontWeight: '500' },
  statLbl:  { fontSize: 9, marginTop: 1 },

  // List
  listContent: { flexGrow: 1 },

  // Grupo header
  grupoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  grupoLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupoDot:     { width: 6, height: 6, borderRadius: 3 },
  grupoLabel:   { fontSize: 12, fontWeight: '500' },
  grupoCount:   { fontSize: 11 },
  grupoTotales: { flexDirection: 'row', gap: 10 },
  grupoTotal:   { fontSize: 11, fontWeight: '500' },
  grupoSpacer:  { height: 8 },

  // Transaction row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
  },
  txIcon:    { width: 40, height: 40, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo:    { flex: 1, gap: 2 },
  txTitle:   { fontSize: 14, fontWeight: '500' },
  txMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txMetaTxt: { fontSize: 11 },
  txMetaDot: { width: 3, height: 3, borderRadius: 1.5 },
  txAmount:  { fontSize: 15, fontWeight: '500' },

  // Modal
  modalRoot: { flex: 1 },
  modalHandleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  modalHandle: { width: 36, height: 4, borderRadius: 2 },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '500' },
  modalScrollContent: { padding: 20, gap: 16 },
  modalAmountWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  modalAmountIcon: { width: 64, height: 64, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalAmount:    { fontSize: 32, fontWeight: '500' },
  modalAmountSub: { fontSize: 14 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  modalRowLabel: { fontSize: 13, flex: 1 },
  modalRowValue: { fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginTop: 8,
  },
  modalDeleteTxt: { fontSize: 14, fontWeight: '500' },
});
