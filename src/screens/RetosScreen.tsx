import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, FeatherName } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { useTheme } from '../state/ThemeContext';
import { RETOS_DISPONIBLES, RetoComunidad, calcularProgresoReto, getDiasRestantes } from '../services/RetosService';
import { THEME } from '../constants/theme';
import { AppColors } from '../constants/colors';

interface RetosScreenProps { onPremiumPress?: () => void; onBack?: () => void; }

export const RetosScreen: React.FC<RetosScreenProps> = ({ onPremiumPress, onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { retoActivo, retosCompletados, iniciarReto, completarReto, abandonarReto, transactions, premium } = useFinance();

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const DIFICULTAD_COLORS = { facil: colors.income, medio: colors.warning, dificil: colors.expense };
  const DIFICULTAD_LABELS = { facil: 'Facil', medio: 'Medio', dificil: 'Dificil' };

  const retoActivoData = retoActivo ? RETOS_DISPONIBLES.find(r => r.id === retoActivo.retoId) : null;
  const progresoActivo = retoActivoData && retoActivo ? calcularProgresoReto(retoActivoData, transactions, retoActivo.fechaInicio) : 0;
  const diasRestantes  = retoActivo && retoActivoData ? getDiasRestantes(retoActivo.fechaInicio, retoActivoData.duracionDias) : 0;
  const retosDisponibles = RETOS_DISPONIBLES.filter(r => r.id !== retoActivo?.retoId);

  // Verificación real: el reto se completa solo cuando el progreso —medido
  // contra las transacciones del usuario— llega al 100 %.
  useEffect(() => {
    if (
      retoActivo && retoActivoData &&
      progresoActivo >= 100 &&
      !retosCompletados.includes(retoActivoData.id)
    ) {
      completarReto(retoActivoData.id, retoActivoData.xpRecompensa);
    }
  }, [progresoActivo, retoActivo, retoActivoData, retosCompletados, completarReto]);

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
    if (progresoActivo < 100) {
      Alert.alert(
        'Aún no cumples la meta',
        'Llevas ' + Math.round(progresoActivo) + '% del reto. Se marcará automáticamente en cuanto lo completes, según tus movimientos.',
      );
      return;
    }
    completarReto(retoActivoData.id, retoActivoData.xpRecompensa);
    Alert.alert('Reto completado', '¡Felicidades! +' + retoActivoData.xpRecompensa + ' XP ganados.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, onBack && { flex: 1, textAlign: 'center' }]}>Retos</Text>
        <Icon name="award" size={20} color={colors.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {retoActivoData && retoActivo && (
          <View style={styles.activoCard}>
            <View style={styles.activoHeader}>
              <Icon name={(retoActivoData.emoji || 'target') as FeatherName} size={24} color={colors.primary} />
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
                <Icon name="check" size={16} color="#fff" />
                <Text style={styles.btnCompletarText}>Marcar completado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAbandonar} onPress={() => Alert.alert('Abandonar reto', 'Seguro que quieres abandonar?', [{ text: 'No' }, { text: 'Abandonar', style: 'destructive', onPress: abandonarReto }])}>
                <Text style={styles.btnAbandonarText}>Abandonar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>Retos disponibles</Text>
        {retosDisponibles.map(reto => {
          const completado = retosCompletados.includes(reto.id);
          const bloqueado  = reto.isPremium && !premium.isPremium;
          return (
            <View key={reto.id} style={[styles.retoCard, completado && styles.retoCardDone]}>
              <View style={styles.retoHeader}>
                <Icon name={(reto.emoji || 'target') as FeatherName} size={20} color={bloqueado ? colors.textTertiary : colors.primary} />
                <View style={{ flex: 1 }}>
                  <View style={styles.retoTitleRow}>
                    <Text style={styles.retoTitle}>{reto.titulo}</Text>
                    {bloqueado  && <View style={styles.premiumBadge}><Text style={styles.premiumText}>PREMIUM</Text></View>}
                    {completado && <Icon name="check-circle" size={16} color={colors.income} />}
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
                  <Icon name={bloqueado ? 'lock' : 'play'} size={14} color={bloqueado ? colors.textTertiary : colors.primary} />
                  <Text style={[styles.btnUnirseText, bloqueado && { color: colors.textTertiary }]}>{bloqueado ? 'Desbloquear Premium' : 'Unirme al reto'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  headerTitle:       { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  scroll:            { padding: 16, paddingBottom: 32, gap: 14 },
  activoCard:        { backgroundColor: colors.primaryLight, borderRadius: THEME.radius.lg, borderWidth: 2, borderColor: colors.primary, padding: 16, gap: 10 },
  activoHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activoTitle:       { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  progressTrack:     { height: 8, backgroundColor: colors.card, borderRadius: 4, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  activoSub:         { fontSize: 12, color: colors.textSecondary },
  activoParticipantes:{ fontSize: 12, color: colors.primary, fontWeight: '600' },
  activoBtns:        { flexDirection: 'row', gap: 8 },
  btnCompletar:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
  btnCompletarText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  btnAbandonar:      { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnAbandonarText:  { fontSize: 13, fontWeight: '600', color: colors.textTertiary },
  sectionLabel:      { fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  retoCard:          { backgroundColor: colors.card, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  retoCardDone:      { borderColor: colors.income, backgroundColor: colors.cardSecondary },
  retoHeader:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  retoTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  retoTitle:         { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  retoDesc:          { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },
  retoMeta:          { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  difBadge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: THEME.radius.pill },
  difText:           { fontSize: 10, fontWeight: '700' },
  retoDuracion:      { fontSize: 11, color: colors.textTertiary },
  retoXP:            { fontSize: 11, fontWeight: '700', color: colors.primary },
  retoParticipantes: { fontSize: 11, color: colors.textTertiary },
  btnUnirse:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingVertical: 9 },
  btnUnirseBlocked:  { borderColor: colors.border },
  btnUnirseText:     { fontSize: 13, fontWeight: '700', color: colors.primary },
  premiumBadge:      { backgroundColor: colors.primary, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  premiumText:       { fontSize: 9, fontWeight: '800', color: '#fff' },
});
