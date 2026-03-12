import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, FeatherName } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { RETOS_DISPONIBLES, RetoComunidad, calcularProgresoReto, getDiasRestantes } from '../services/RetosService';

const DIFICULTAD_COLORS = { facil: '#10B981', medio: '#F59E0B', dificil: '#EF4444' };
const DIFICULTAD_LABELS = { facil: 'Facil', medio: 'Medio', dificil: 'Dificil' };

interface RetosScreenProps { onPremiumPress?: () => void; }

export const RetosScreen: React.FC<RetosScreenProps> = ({ onPremiumPress }) => {
  const insets = useSafeAreaInsets();
  const { retoActivo, retosCompletados, iniciarReto, completarReto, abandonarReto, transactions, premium } = useFinance();

  const retoActivoData = retoActivo ? RETOS_DISPONIBLES.find(r => r.id === retoActivo.retoId) : null;
  const progresoActivo = retoActivoData && retoActivo ? calcularProgresoReto(retoActivoData, transactions, retoActivo.fechaInicio) : 0;
  const diasRestantes = retoActivo && retoActivoData ? getDiasRestantes(retoActivo.fechaInicio, retoActivoData.duracionDias) : 0;

  const retosDisponibles = RETOS_DISPONIBLES.filter(r => r.id !== retoActivo?.retoId);

  const handleIniciarReto = (reto: RetoComunidad) => {
    if (reto.isPremium && !premium.isPremium) { onPremiumPress?.(); return; }
    if (retoActivo) {
      Alert.alert('Reto activo', 'Ya tienes un reto en curso. Debes completarlo o abandonarlo antes de iniciar otro.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abandonar y cambiar', style: 'destructive', onPress: () => { abandonarReto(); iniciarReto(reto.id); } },
      ]);
      return;
    }
    Alert.alert('Unirte al reto', 'Quieres comenzar "' + reto.titulo + '"?\n+' + reto.xpRecompensa + ' XP al completar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Comenzar', onPress: () => iniciarReto(reto.id) },
    ]);
  };

  const handleCompletarReto = () => {
    if (!retoActivoData) return;
    completarReto(retoActivoData.id, retoActivoData.xpRecompensa);
    Alert.alert('Reto completado', '¡Felicidades! +' + retoActivoData.xpRecompensa + ' XP ganados.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Retos</Text>
        <Icon name="award" size={20} color="#6366F1" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Reto activo */}
        {retoActivoData && retoActivo && (
          <View style={styles.activoCard}>
            <View style={styles.activoHeader}>
              <Icon name={(retoActivoData.emoji || 'target') as FeatherName} size={24} color="#6366F1" />
              <Text style={styles.activoTitle}>{retoActivoData.titulo}</Text>
              <View style={[styles.difBadge, { backgroundColor: DIFICULTAD_COLORS[retoActivoData.dificultad] + '20' }]}>
                <Text style={[styles.difText, { color: DIFICULTAD_COLORS[retoActivoData.dificultad] }]}>{DIFICULTAD_LABELS[retoActivoData.dificultad]}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: (Math.round(progresoActivo) + '%') as any }]} />
            </View>
            <Text style={styles.activoSub}>{Math.round(progresoActivo)}% completado · {diasRestantes} dias restantes</Text>
            <Text style={styles.activoParticipantes}>
              {retoActivoData.participantesSimulados.toLocaleString('es-CO')} personas lo hacen contigo
            </Text>
            <View style={styles.activoBtns}>
              <TouchableOpacity style={styles.btnCompletar} onPress={handleCompletarReto}>
                <Icon name="check" size={16} color="#FFFFFF" />
                <Text style={styles.btnCompletarText}>Marcar completado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAbandonar} onPress={() => Alert.alert('Abandonar reto', 'Seguro que quieres abandonar?', [{ text: 'No' }, { text: 'Abandonar', style: 'destructive', onPress: abandonarReto }])}>
                <Text style={styles.btnAbandonarText}>Abandonar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Retos disponibles */}
        <Text style={styles.sectionLabel}>Retos disponibles</Text>
        {retosDisponibles.map(reto => {
          const completado = retosCompletados.includes(reto.id);
          const bloqueado = reto.isPremium && !premium.isPremium;
          return (
            <View key={reto.id} style={[styles.retoCard, completado && styles.retoCardDone]}>
              <View style={styles.retoHeader}>
                <Icon name={(reto.emoji || 'target') as FeatherName} size={20} color={bloqueado ? '#9CA3AF' : '#6366F1'} />
                <View style={{ flex: 1 }}>
                  <View style={styles.retoTitleRow}>
                    <Text style={styles.retoTitle}>{reto.titulo}</Text>
                    {bloqueado && <View style={styles.premiumBadge}><Text style={styles.premiumText}>PREMIUM</Text></View>}
                    {completado && <Icon name="check-circle" size={16} color="#10B981" />}
                  </View>
                  <Text style={styles.retoDesc}>{reto.descripcion}</Text>
                </View>
              </View>
              <View style={styles.retoMeta}>
                <View style={[styles.difBadge, { backgroundColor: DIFICULTAD_COLORS[reto.dificultad] + '20' }]}>
                  <Text style={[styles.difText, { color: DIFICULTAD_COLORS[reto.dificultad] }]}>{DIFICULTAD_LABELS[reto.dificultad]}</Text>
                </View>
                <Text style={styles.retoDuracion}>{reto.duracionDias} dias</Text>
                <Text style={styles.retoXP}>+{reto.xpRecompensa} XP</Text>
                <Text style={styles.retoParticipantes}>{reto.participantesSimulados.toLocaleString('es-CO')} participantes</Text>
              </View>
              {!completado && (
                <TouchableOpacity style={[styles.btnUnirse, bloqueado && styles.btnUnirseBlocked]} onPress={() => handleIniciarReto(reto)} activeOpacity={0.8}>
                  <Icon name={bloqueado ? 'lock' : 'play'} size={14} color={bloqueado ? '#9CA3AF' : '#6366F1'} />
                  <Text style={[styles.btnUnirseText, bloqueado && { color: '#9CA3AF' }]}>{bloqueado ? 'Desbloquear Premium' : 'Unirme al reto'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  activoCard: { backgroundColor: '#EEF2FF', borderRadius: 16, borderWidth: 2, borderColor: '#6366F1', padding: 16, gap: 10 },
  activoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activoTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' },
  progressTrack: { height: 8, backgroundColor: '#FFFFFF', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  activoSub: { fontSize: 12, color: '#6B7280' },
  activoParticipantes: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  activoBtns: { flexDirection: 'row', gap: 8 },
  btnCompletar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 10 },
  btnCompletarText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnAbandonar: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  btnAbandonarText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase' },
  retoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 10 },
  retoCardDone: { borderColor: '#DCFCE7', backgroundColor: '#F0FDF4' },
  retoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  retoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  retoTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  retoDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  retoMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  difBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  difText: { fontSize: 10, fontWeight: '700' },
  retoDuracion: { fontSize: 11, color: '#9CA3AF' },
  retoXP: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
  retoParticipantes: { fontSize: 11, color: '#9CA3AF' },
  btnUnirse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#6366F1', borderRadius: 10, paddingVertical: 9 },
  btnUnirseBlocked: { borderColor: '#E5E7EB' },
  btnUnirseText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  premiumBadge: { backgroundColor: '#6366F1', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  premiumText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});
