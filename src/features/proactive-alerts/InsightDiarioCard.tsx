/**
 * InsightDiarioCard — card compacta del dashboard.
 * Muestra el insight diario de Finn y las alertas pendientes.
 * Se auto-oculta si no hay alertas hoy.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useTheme }             from '../../state/ThemeContext';
import { Icon }                 from '../../components/ui/Icon';
import { useProactiveAlerts }   from './useProactiveAlerts';
import type { FinnAlerta, TipoAlerta } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_ICONO: Record<TipoAlerta, string> = {
  presupuesto_80pct:          'alert-circle',
  presupuesto_100pct:         'alert-triangle',
  gasto_aumento_categoria:    'trending-up',
  gasto_anomalo:              'zap',
  compromiso_saldo_ajustado:  'calendar',
  ritmo_insostenible:         'activity',
  racha_ahorro:               'award',
  meta_cerca:                 'target',
  insight_diario:             'sun',
};

const POSITIVAS: TipoAlerta[] = ['racha_ahorro', 'meta_cerca', 'insight_diario'];

function tipoIcono(tipo: TipoAlerta): string {
  return TIPO_ICONO[tipo] ?? 'bell';
}

function esPositiva(tipo: TipoAlerta): boolean {
  return POSITIVAS.includes(tipo);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 60)  return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

// ── Alerta individual en el panel ─────────────────────────────────────────────

interface AlertaRowProps {
  alerta:      FinnAlerta;
  onMarcar:    (id: string) => void;
  accentColor: string;
  colors:      any;
  isDark:      boolean;
}

function AlertaRow({ alerta, onMarcar, accentColor, colors, isDark }: AlertaRowProps) {
  const positiva = esPositiva(alerta.tipo_alerta as TipoAlerta);
  const iconColor = positiva ? '#1D9E75' : accentColor;
  const bgColor   = alerta.leido
    ? 'transparent'
    : isDark ? 'rgba(97,86,232,0.08)' : 'rgba(97,86,232,0.05)';

  return (
    <Pressable
      style={[st.alertaRow, { backgroundColor: bgColor }]}
      onPress={() => !alerta.leido && onMarcar(alerta.id)}
    >
      <View style={[st.alertaIcon, { backgroundColor: positiva ? '#D1FAE5' : colors.primaryLight }]}>
        <Icon name={tipoIcono(alerta.tipo_alerta as TipoAlerta) as any} size={15} color={iconColor} />
      </View>
      <View style={st.alertaBody}>
        <Text style={[st.alertaMsg, { color: colors.textPrimary, opacity: alerta.leido ? 0.55 : 1 }]} numberOfLines={3}>
          {alerta.mensaje}
        </Text>
        <Text style={[st.alertaTime, { color: colors.textTertiary }]}>
          {timeAgo(alerta.enviado_at)}
          {!alerta.leido && <Text style={{ color: accentColor }}> · Toca para marcar leído</Text>}
        </Text>
      </View>
      {!alerta.leido && (
        <View style={[st.unreadDot, { backgroundColor: accentColor }]} />
      )}
    </Pressable>
  );
}

// ── Panel completo de alertas ─────────────────────────────────────────────────

interface AlertasPanelProps {
  visible:           boolean;
  onClose:           () => void;
  alertas:           FinnAlerta[];
  onMarcarLeida:     (id: string) => void;
  onMarcarTodas:     () => void;
}

function AlertasPanel({ visible, onClose, alertas, onMarcarLeida, onMarcarTodas }: AlertasPanelProps) {
  const { colors, isDark, accentColor } = useTheme();
  const noLeidas = alertas.filter(a => !a.leido).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.panelBackdrop}>
        <View style={[st.panelSheet, { backgroundColor: colors.card }]}>
          <View style={st.panelHeader}>
            <Text style={[st.panelTitle, { color: colors.textPrimary }]}>
              Alertas de Finn
            </Text>
            <View style={st.panelHeaderRight}>
              {noLeidas > 0 && (
                <Pressable onPress={onMarcarTodas} style={st.marcarTodasBtn}>
                  <Text style={[st.marcarTodasText, { color: accentColor }]}>Marcar todas</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {alertas.length === 0 ? (
            <View style={st.emptyState}>
              <Icon name="bell-off" size={32} color={colors.textTertiary} />
              <Text style={[st.emptyText, { color: colors.textSecondary }]}>
                Sin alertas por hoy
              </Text>
            </View>
          ) : (
            <FlatList
              data={alertas}
              keyExtractor={a => a.id}
              renderItem={({ item }) => (
                <AlertaRow
                  alerta={item}
                  onMarcar={onMarcarLeida}
                  accentColor={accentColor}
                  colors={colors}
                  isDark={isDark}
                />
              )}
              ItemSeparatorComponent={() => (
                <View style={[st.separator, { backgroundColor: colors.border }]} />
              )}
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── InsightDiarioCard ─────────────────────────────────────────────────────────

interface InsightDiarioCardProps {
  onOpenBot?: (msg?: string) => void;
}

export function InsightDiarioCard({ onOpenBot }: InsightDiarioCardProps) {
  const { colors, isDark, accentColor } = useTheme();
  const {
    alertasHoy, insightDiario, noLeidas, isRunning,
    marcarLeida, marcarTodasLeidas,
  } = useProactiveAlerts();

  const [panelVisible, setPanelVisible] = useState(false);

  // Si no hay nada hoy (y no está cargando), no renderizar
  if (!isRunning && alertasHoy.length === 0) return null;

  // Si hay insight diario, mostrar esa card; si no, mostrar la primera alerta
  const principal = insightDiario ?? alertasHoy[0] ?? null;
  if (!principal && !isRunning) return null;

  const positiva   = principal ? esPositiva(principal.tipo_alerta as TipoAlerta) : false;
  const iconColor  = positiva ? '#1D9E75' : accentColor;
  const iconBg     = positiva
    ? (isDark ? '#064E3B' : '#D1FAE5')
    : (isDark ? '#1E1B4B' : colors.primaryLight);

  return (
    <>
      <Pressable
        style={[
          st.card,
          {
            backgroundColor: colors.card,
            borderColor:     isDark ? 'rgba(255,255,255,0.06)' : colors.border,
          },
        ]}
        onPress={() => setPanelVisible(true)}
      >
        {/* Icono Finn */}
        <View style={[st.finnBadge, { backgroundColor: accentColor }]}>
          <Text style={st.finnBadgeText}>FI</Text>
        </View>

        {/* Contenido */}
        <View style={st.cardBody}>
          <Text style={[st.cardLabel, { color: colors.textTertiary }]}>
            {isRunning ? 'Finn está analizando…' : 'Finn · Hoy'}
          </Text>
          {principal && !isRunning && (
            <Text
              style={[st.cardMsg, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {principal.mensaje}
            </Text>
          )}
          {isRunning && (
            <Text style={[st.cardMsg, { color: colors.textSecondary }]}>
              Revisando tu situación financiera…
            </Text>
          )}
        </View>

        {/* Badge de no leídas */}
        <View style={st.cardRight}>
          {noLeidas > 0 && (
            <View style={[st.badge, { backgroundColor: accentColor }]}>
              <Text style={st.badgeText}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
            </View>
          )}
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>

      {/* Botón "Preguntarle a Finn" si hay insight */}
      {insightDiario && onOpenBot && (
        <Pressable
          style={[st.preguntarBtn, { borderColor: accentColor + '40' }]}
          onPress={() => onOpenBot(
            `Finn, cuéntame más sobre mi situación de hoy: ${insightDiario.mensaje}`
          )}
        >
          <Icon name="message-circle" size={13} color={accentColor} />
          <Text style={[st.preguntarText, { color: accentColor }]}>
            Preguntarle más a Finn
          </Text>
        </Pressable>
      )}

      <AlertasPanel
        visible={panelVisible}
        onClose={() => setPanelVisible(false)}
        alertas={alertasHoy}
        onMarcarLeida={marcarLeida}
        onMarcarTodas={marcarTodasLeidas}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // Card principal
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   16,
    borderWidth:    1,
    padding:        14,
    marginBottom:   10,
    gap:            12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  finnBadge: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  finnBadgeText: {
    color:      '#FFF',
    fontWeight: '800',
    fontSize:   12,
  },
  cardBody: {
    flex: 1,
    gap:  3,
  },
  cardLabel: {
    fontSize:   11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  cardMsg: {
    fontSize:   13,
    lineHeight: 18,
    fontWeight: '400',
  },
  cardRight: {
    alignItems:  'center',
    flexDirection: 'row',
    gap:          6,
    flexShrink:   0,
  },
  badge: {
    minWidth:       18,
    height:         18,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color:      '#FFF',
    fontSize:   10,
    fontWeight: '700',
  },

  // "Preguntarle a Finn"
  preguntarBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius:   12,
    borderWidth:    1,
    alignSelf:      'flex-start',
    marginBottom:   12,
  },
  preguntarText: {
    fontSize:   12,
    fontWeight: '500',
  },

  // Panel modal
  panelBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  panelSheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    maxHeight:            '75%',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 16 },
    }),
  },
  panelHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        20,
    paddingBottom:  12,
  },
  panelTitle: {
    fontSize:   17,
    fontWeight: '600',
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  marcarTodasBtn: {
    paddingVertical: 4,
  },
  marcarTodasText: {
    fontSize:   13,
    fontWeight: '500',
  },

  // Alerta row en panel
  alertaRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingHorizontal: 20,
    paddingVertical:   14,
    gap:            12,
  },
  alertaIcon: {
    width:          30,
    height:         30,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    marginTop:      1,
  },
  alertaBody: {
    flex: 1,
    gap:  4,
  },
  alertaMsg: {
    fontSize:   13,
    lineHeight: 18,
  },
  alertaTime: {
    fontSize: 11,
  },
  unreadDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
    marginTop:    6,
    flexShrink:   0,
  },
  separator: {
    height:           StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:        40,
    gap:            12,
  },
  emptyText: {
    fontSize: 14,
  },
});
