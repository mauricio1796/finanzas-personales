import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { THEME } from '../constants/theme';
import { AppColors } from '../constants/colors';
import { AcademiaScreen } from './AcademiaScreen';
import { CalendarioScreen } from './CalendarioScreen';
import { ProyeccionesScreen } from './ProyeccionesScreen';
import { RetosScreen } from './RetosScreen';
import { PremiumScreen } from './PremiumScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ExplorarTab = 'academia' | 'calendario' | 'proyecciones' | 'retos';
const TABS: { id: ExplorarTab; label: string }[] = [
  { id: 'academia',     label: 'Academia' },
  { id: 'calendario',   label: 'Calendario' },
  { id: 'proyecciones', label: 'Proyecciones' },
  { id: 'retos',        label: 'Retos' },
];

interface ExplorarScreenProps { onBack?: () => void; }

export const ExplorarScreen: React.FC<ExplorarScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab]   = useState<ExplorarTab>('academia');
  const [showPremium, setShowPremium] = useState(false);
  const insets  = useSafeAreaInsets();
  const { colors } = useTheme();

  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (showPremium) {
    return <PremiumScreen onBack={() => setShowPremium(false)} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {onBack && (
        <View style={styles.backRow}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.backTitle, { color: colors.textPrimary }]}>Explorar</Text>
          <View style={{ width: 32 }} />
        </View>
      )}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.tabIndicatorTrack}>
          <View style={[styles.tabIndicatorFill, { width: (100 / TABS.length + '%') as any, left: (TABS.findIndex(t => t.id === activeTab) / TABS.length * 100 + '%') as any }]} />
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'academia'     && <AcademiaScreen onPremiumPress={() => setShowPremium(true)} />}
        {activeTab === 'calendario'   && <CalendarioScreen />}
        {activeTab === 'proyecciones' && <ProyeccionesScreen onPremiumPress={() => setShowPremium(true)} />}
        {activeTab === 'retos'        && <RetosScreen onPremiumPress={() => setShowPremium(true)} />}
      </View>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background },
  backRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn:             { width: 32, alignItems: 'flex-start' },
  backIcon:            { fontSize: 20 },
  backTitle:           { fontSize: 17, fontWeight: '500', flex: 1, textAlign: 'center' },
  tabBar:              { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent:       { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 0, flexDirection: 'row' },
  tab:                 { paddingHorizontal: 16, paddingVertical: 10 },
  tabLabel:            { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
  tabLabelActive:      { color: colors.primary, fontWeight: '700' },
  tabIndicatorTrack:   { height: 3, backgroundColor: 'transparent', position: 'relative' },
  tabIndicatorFill:    { position: 'absolute', height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  content:             { flex: 1 },
});
