import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, FeatherName } from '../components/ui/Icon';
import { useFinance } from '../state/FinanceContext';
import { LECCIONES, Leccion, calcularProgresoAcademia } from '../services/AcademiaService';

type TabNivel = 'todos' | 'basico' | 'intermedio' | 'avanzado';
const NIVEL_COLORS = { basico: '#10B981', intermedio: '#F59E0B', avanzado: '#EF4444' };
const NIVEL_LABELS = { basico: 'Basico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

interface AcademiaScreenProps { onPremiumPress?: () => void; }

export const AcademiaScreen: React.FC<AcademiaScreenProps> = ({ onPremiumPress }) => {
  const insets = useSafeAreaInsets();
  const { leccionesCompletadas, premium } = useFinance();
  const [tabNivel, setTabNivel] = useState<TabNivel>('todos');
  const [leccionActiva, setLeccionActiva] = useState<Leccion | null>(null);

  const progreso = calcularProgresoAcademia(leccionesCompletadas);
  const leccionesFiltradas = tabNivel === 'todos' ? LECCIONES : LECCIONES.filter(l => l.nivel === tabNivel);

  if (leccionActiva) {
    return <LeccionPlayer leccion={leccionActiva} onBack={() => setLeccionActiva(null)} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Academia</Text>
        <Icon name="book-open" size={20} color="#6366F1" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Tu progreso</Text>
            <Text style={styles.progressPct}>{progreso.porcentaje}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: (progreso.porcentaje + '%') as any }]} />
          </View>
          <Text style={styles.progressSub}>{leccionesCompletadas.length}/{LECCIONES.length} lecciones · {progreso.xpTotal} XP ganados</Text>
          <View style={styles.nivelStats}>
            <Text style={styles.nivelStat}>Basico: {progreso.basico}/3</Text>
            <Text style={styles.nivelStat}>Intermedio: {progreso.intermedio}/2</Text>
            <Text style={styles.nivelStat}>Avanzado: {progreso.avanzado}/3</Text>
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={styles.filterRow}>
            {(['todos', 'basico', 'intermedio', 'avanzado'] as TabNivel[]).map(t => (
              <TouchableOpacity key={t} style={[styles.filterTab, tabNivel === t && styles.filterTabActive]} onPress={() => setTabNivel(t)}>
                <Text style={[styles.filterTabText, tabNivel === t && styles.filterTabTextActive]}>
                  {t === 'todos' ? 'Todos' : NIVEL_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Lecciones */}
        {leccionesFiltradas.map((leccion, idx) => {
          const completada = leccionesCompletadas.includes(leccion.id);
          const bloqueada = leccion.isPremium && !premium.isPremium;
          const nivelColor = NIVEL_COLORS[leccion.nivel];
          return (
            <TouchableOpacity
              key={leccion.id}
              style={[styles.leccionCard, completada && styles.leccionCardDone, bloqueada && styles.leccionCardLocked]}
              onPress={() => bloqueada ? onPremiumPress?.() : setLeccionActiva(leccion)}
              activeOpacity={0.8}
            >
              <View style={[styles.leccionIcon, { backgroundColor: completada ? '#DCFCE7' : bloqueada ? '#F3F4F6' : '#EEF2FF' }]}>
                {completada ? <Icon name="check-circle" size={22} color="#10B981" /> : bloqueada ? <Icon name="lock" size={22} color="#9CA3AF" /> : <Icon name="play-circle" size={22} color="#6366F1" />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.leccionTitleRow}>
                  <Text style={[styles.leccionTitle, completada && { color: '#6B7280' }]} numberOfLines={1}>{leccion.titulo}</Text>
                  {bloqueada && <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>PREMIUM</Text></View>}
                </View>
                <Text style={styles.leccionDesc} numberOfLines={1}>{leccion.descripcion}</Text>
                <View style={styles.leccionMeta}>
                  <View style={[styles.nivelBadge, { backgroundColor: nivelColor + '20' }]}>
                    <Text style={[styles.nivelBadgeText, { color: nivelColor }]}>{NIVEL_LABELS[leccion.nivel]}</Text>
                  </View>
                  <Text style={styles.duracion}>{leccion.duracionMin} min</Text>
                  <Text style={styles.xp}>+{leccion.xpRecompensa} XP</Text>
                </View>
              </View>
              {!bloqueada && <Icon name="chevron-right" size={16} color="#D1D5DB" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ─── Leccion Player ───────────────────────────────────────────────────────────
const LeccionPlayer: React.FC<{ leccion: Leccion; onBack: () => void }> = ({ leccion, onBack }) => {
  const { completarLeccion, leccionesCompletadas, userLevel, setUserLevel } = useFinance();
  const [paso, setPaso] = useState(0);
  const [fase, setFase] = useState<'pasos' | 'quiz' | 'resultado'>('pasos');
  const [quizIdx, setQuizIdx] = useState(0);
  const [opcionSel, setOpcionSel] = useState<number | null>(null);
  const [aciertos, setAciertos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  const completada = leccionesCompletadas.includes(leccion.id);
  const totalPasos = leccion.pasos.length;
  const totalQuiz = leccion.quiz.length;
  const progresoPasos = fase === 'pasos' ? ((paso + 1) / totalPasos) * 100 : 100;

  const animarTransicion = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(cb);
  };

  const handleSiguiente = () => {
    if (paso < totalPasos - 1) {
      animarTransicion(() => setPaso(p => p + 1));
    } else {
      if (totalQuiz > 0) { animarTransicion(() => setFase('quiz')); }
      else { finalizarLeccion(); }
    }
  };

  const handleConfirmarQuiz = () => {
    if (opcionSel === null) return;
    const correcto = opcionSel === leccion.quiz[quizIdx].correcta;
    if (correcto) setAciertos(a => a + 1);
    if (quizIdx < totalQuiz - 1) {
      animarTransicion(() => { setQuizIdx(i => i + 1); setOpcionSel(null); });
    } else {
      setFase('resultado');
    }
  };

  const finalizarLeccion = () => {
    if (!completada) {
      completarLeccion(leccion.id);
      if (userLevel) if (userLevel) setUserLevel({ ...userLevel, experience: (userLevel.experience || 0) + leccion.xpRecompensa });
    }
    setFinalizado(true);
    setFase('resultado');
  };

  if (fase === 'resultado' || finalizado) {
    return (
      <View style={[ps.container, { paddingTop: insets.top }]}>
        <View style={ps.header}>
          <TouchableOpacity onPress={onBack} style={ps.backBtn}><Icon name="x" size={20} color="#374151" /></TouchableOpacity>
          <Text style={ps.headerTitle}>{leccion.titulo}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={ps.resultadoContainer}>
          <Text style={{ fontSize: 64 }}>🎉</Text>
          <Text style={ps.resultadoTitulo}>Leccion completada</Text>
          {!completada && <Text style={ps.resultadoXP}>+{leccion.xpRecompensa} XP ganados</Text>}
          <Text style={ps.resultadoSub}>{aciertos}/{totalQuiz} respuestas correctas en el quiz</Text>
          <TouchableOpacity style={ps.btnPrimary} onPress={onBack}>
            <Text style={ps.btnPrimaryText}>Volver a Academia</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (fase === 'quiz') {
    const q = leccion.quiz[quizIdx];
    return (
      <View style={[ps.container, { paddingTop: insets.top }]}>
        <View style={ps.header}>
          <TouchableOpacity onPress={onBack} style={ps.backBtn}><Icon name="arrow-left" size={20} color="#374151" /></TouchableOpacity>
          <Text style={ps.headerTitle}>Quiz</Text>
          <Text style={ps.pasoIndicator}>{quizIdx + 1}/{totalQuiz}</Text>
        </View>
        <Animated.View style={[ps.quizContent, { opacity: fadeAnim }]}>
          <Text style={ps.quizPregunta}>{q.pregunta}</Text>
          {q.opciones.map((op, i) => (
            <TouchableOpacity key={i} style={[ps.opcionBtn, opcionSel === i && ps.opcionBtnSel]} onPress={() => setOpcionSel(i)} activeOpacity={0.8}>
              <View style={[ps.opcionRadio, opcionSel === i && ps.opcionRadioSel]}>{opcionSel === i && <View style={ps.opcionRadioDot} />}</View>
              <Text style={[ps.opcionText, opcionSel === i && { color: '#6366F1', fontWeight: '700' }]}>{op}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[ps.btnPrimary, opcionSel === null && { opacity: 0.4 }]} onPress={handleConfirmarQuiz} disabled={opcionSel === null}>
            <Text style={ps.btnPrimaryText}>Confirmar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  const pasoActual = leccion.pasos[paso];
  return (
    <View style={[ps.container, { paddingTop: insets.top }]}>
      <View style={ps.header}>
        <TouchableOpacity onPress={onBack} style={ps.backBtn}><Icon name="arrow-left" size={20} color="#374151" /></TouchableOpacity>
        <Text style={ps.headerTitle} numberOfLines={1}>{leccion.titulo}</Text>
        <Text style={ps.pasoIndicator}>{paso + 1}/{totalPasos}</Text>
      </View>
      <View style={ps.progressBar}><View style={[ps.progressFill, { width: (progresoPasos + '%') as any }]} /></View>
      <ScrollView contentContainerStyle={ps.scroll}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[ps.pasoCard, { backgroundColor: '#EEF2FF' }]}>
            <Icon name={(pasoActual.icon || 'book-open') as FeatherName} size={32} color="#6366F1" />
            <Text style={ps.pasoTipo}>{pasoActual.tipo.toUpperCase()}</Text>
            <Text style={ps.pasoTitulo}>{pasoActual.titulo}</Text>
            <Text style={ps.pasoContenido}>{pasoActual.contenido}</Text>
          </View>
        </Animated.View>
        <TouchableOpacity style={ps.btnPrimary} onPress={handleSiguiente}>
          <Text style={ps.btnPrimaryText}>{paso < totalPasos - 1 ? 'Siguiente' : totalQuiz > 0 ? 'Ir al Quiz' : 'Completar'}</Text>
          <Icon name="arrow-right" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  progressPct: { fontSize: 20, fontWeight: '800', color: '#6366F1' },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  progressSub: { fontSize: 12, color: '#9CA3AF' },
  nivelStats: { flexDirection: 'row', gap: 12 },
  nivelStat: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  filterTabActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  leccionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  leccionCardDone: { borderColor: '#DCFCE7', backgroundColor: '#F0FDF4' },
  leccionCardLocked: { opacity: 0.7 },
  leccionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  leccionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  leccionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  leccionDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  leccionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  nivelBadgeText: { fontSize: 10, fontWeight: '700' },
  duracion: { fontSize: 11, color: '#9CA3AF' },
  xp: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
  premiumBadge: { backgroundColor: '#6366F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  premiumBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
});

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  pasoIndicator: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  progressBar: { height: 4, backgroundColor: '#F3F4F6' },
  progressFill: { height: 4, backgroundColor: '#6366F1' },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },
  pasoCard: { borderRadius: 20, padding: 24, gap: 10, alignItems: 'center' },
  pasoTipo: { fontSize: 10, fontWeight: '800', color: '#6366F1', letterSpacing: 1 },
  pasoTitulo: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  pasoContenido: { fontSize: 15, color: '#374151', lineHeight: 24, textAlign: 'center' },
  btnPrimary: { backgroundColor: '#6366F1', borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  quizContent: { flex: 1, padding: 16, gap: 12 },
  quizPregunta: { fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 26, marginBottom: 8 },
  opcionBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  opcionBtnSel: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  opcionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  opcionRadioSel: { borderColor: '#6366F1' },
  opcionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366F1' },
  opcionText: { fontSize: 14, color: '#374151', flex: 1 },
  resultadoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  resultadoTitulo: { fontSize: 26, fontWeight: '800', color: '#111827' },
  resultadoXP: { fontSize: 20, fontWeight: '800', color: '#6366F1' },
  resultadoSub: { fontSize: 14, color: '#9CA3AF' },
});
