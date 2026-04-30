import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { THEME } from '../constants/theme';
import { AcademiaScreen } from './AcademiaScreen';
import { CalendarioScreen } from './CalendarioScreen';
import { ProyeccionesScreen } from './ProyeccionesScreen';
import { RetosScreen } from './RetosScreen';
import { PremiumScreen } from './PremiumScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ExplorarTab = 'academia' | 'calendario' | 'proyecciones' | 'retos';
const TABS: { id: ExplorarTab; label: string }[] = [
  { id: 'academia', label: 'Academia' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'proyecciones', label: 'Proyecciones' },
  { id: 'retos', label: 'Retos' },
];

interface ExplorarScreenProps {
  onBack?: () => void;
}

export const ExplorarScreen: React.FC<ExplorarScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ExplorarTab>('academia');
  const [showPremium, setShowPremium] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (showPremium) {
    return <PremiumScreen onBack={() => setShowPremium(false)} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back / title row */}
      {onBack && (
        <View style={[styles.backRow, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.backTitle, { color: colors.textPrimary }]}>Explorar</Text>
          <View style={{ width: 32 }} />
        </View>
      )}
      {/* Top tab bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.tabIndicatorTrack}>
          <View style={[styles.tabIndicatorFill, { width: (100 / TABS.length + '%') as any, left: (TABS.findIndex(t => t.id === activeTab) / TABS.length * 100 + '%') as any }]} />
        </View>
      </View>

      {/* Screen content */}
      <View style={styles.content}>
        {activeTab === 'academia' && <AcademiaScreen onPremiumPress={() => setShowPremium(true)} />}
        {activeTab === 'calendario' && <CalendarioScreen />}
        {activeTab === 'proyecciones' && <ProyeccionesScreen />}
        {activeTab === 'retos' && <RetosScreen onPremiumPress={() => setShowPremium(true)} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  backRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  backBtn:   { width: 32, alignItems: 'flex-start' },
  backIcon:  { fontSize: 20 },
  backTitle: { fontSize: 17, fontWeight: '500', flex: 1, textAlign: 'center' },
  tabBar: { backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.surfaceSecondary },
  tabBarContent: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 0, flexDirection: 'row' },
  tab: { paddingHorizontal: 16, paddingVertical: 10 },
  tabActive: {},
  tabLabel: { fontSize: 14, fontWeight: '600', color: THEME.colors.textTertiary },
  tabLabelActive: { color: THEME.colors.primary, fontWeight: '700' },
  tabIndicatorTrack: { height: 3, backgroundColor: 'transparent', position: 'relative' },
  tabIndicatorFill: { position: 'absolute', height: 3, backgroundColor: THEME.colors.primary, borderRadius: 2 },
  content: { flex: 1 },
});
