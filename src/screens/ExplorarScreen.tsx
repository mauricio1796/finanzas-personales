import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

export const ExplorarScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ExplorarTab>('academia');
  const [showPremium, setShowPremium] = useState(false);
  const insets = useSafeAreaInsets();

  if (showPremium) {
    return <PremiumScreen onBack={() => setShowPremium(false)} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  tabBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBarContent: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 0, flexDirection: 'row' },
  tab: { paddingHorizontal: 16, paddingVertical: 10 },
  tabActive: {},
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabLabelActive: { color: '#6366F1', fontWeight: '700' },
  tabIndicatorTrack: { height: 3, backgroundColor: 'transparent', position: 'relative' },
  tabIndicatorFill: { position: 'absolute', height: 3, backgroundColor: '#6366F1', borderRadius: 2 },
  content: { flex: 1 },
});
