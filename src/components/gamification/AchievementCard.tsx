import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Logro, RARITY_STYLE } from '../../services/GamificacionService';
import { useTheme } from '../../state/ThemeContext';

interface Props {
  logro:    Logro;
  unlocked: boolean;
  isNew?:   boolean;
  onPress?: () => void;
}

const RARITY_LABEL_ES: Record<string, string> = {
  common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
};

export const AchievementCard: React.FC<Props> = ({ logro, unlocked, isNew, onPress }) => {
  const { colors } = useTheme();
  const r = RARITY_STYLE[logro.rarity];

  const glowAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(unlocked ? 1 : 0.95)).current;
  const shineAnim = useRef(new Animated.Value(-1)).current;
  const particles = useRef(
    Array.from({ length: 6 }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      op: new Animated.Value(0), s: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!unlocked) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1600, useNativeDriver: false }),
      ])
    ).start();

    if (logro.rarity === 'legendary') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnim, { toValue: 2, duration: 2000, useNativeDriver: true }),
          Animated.delay(3000),
          Animated.timing(shineAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }

    if (isNew) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.1, tension: 80, friction: 5, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,   tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();

      const ANGLES = [0, 60, 120, 180, 240, 300];
      Animated.stagger(30, particles.map((p, i) => {
        const angle = (ANGLES[i] * Math.PI) / 180;
        const dist  = 30 + Math.random() * 12;
        p.op.setValue(1); p.s.setValue(1);
        return Animated.parallel([
          Animated.timing(p.x,  { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
          Animated.timing(p.y,  { toValue: Math.sin(angle) * dist, duration: 600, useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0,   duration: 600, useNativeDriver: true }),
          Animated.timing(p.s,  { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]);
      })).start();
    }
  }, [unlocked, isNew]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, logro.rarity === 'legendary' ? 0.5 : logro.rarity === 'epic' ? 0.3 : 0.15],
  });

  const lockedIconBg   = colors.cardSecondary;
  const lockedIconColor = colors.border;
  const dimTextColor   = colors.border;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.75 : 1} style={styles.wrapper}>
      <Animated.View style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        !unlocked && { backgroundColor: colors.cardSecondary },
        { transform: [{ scale: scaleAnim }] },
      ]}>

        {unlocked && (
          <Animated.View style={[styles.glow, { backgroundColor: r.glow, opacity: glowOpacity }]} pointerEvents="none" />
        )}

        <View style={styles.particleLayer} pointerEvents="none">
          {particles.map((p, i) => (
            <Animated.View key={i} style={[styles.particle, { backgroundColor: r.glow, opacity: p.op, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.s }] }]} />
          ))}
        </View>

        <View style={[styles.iconBox, { backgroundColor: unlocked ? r.bg : lockedIconBg }, unlocked && logro.rarity === 'legendary' && styles.legendaryBorder]}>
          <Feather name={logro.icono as any} size={22} color={unlocked ? r.color : lockedIconColor} />
        </View>

        <View style={[styles.rarityBadge, { backgroundColor: unlocked ? r.bg : lockedIconBg }]}>
          <Text style={[styles.rarityText, { color: unlocked ? r.color : colors.textTertiary }]}>
            {RARITY_LABEL_ES[logro.rarity]}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }, !unlocked && { color: dimTextColor }]} numberOfLines={1}>{logro.titulo}</Text>
        <Text style={[styles.desc,  { color: colors.textSecondary }, !unlocked && { color: dimTextColor }]} numberOfLines={2}>{logro.descripcion}</Text>

        <View style={[styles.xpRow, { opacity: unlocked ? 1 : 0.4 }]}>
          <Feather name="star" size={10} color={unlocked ? '#F59E0B' : colors.textTertiary} />
          <Text style={[styles.xpText, { color: unlocked ? '#F59E0B' : colors.textTertiary }]}>+{logro.xp} XP</Text>
        </View>

        {!unlocked && <View style={styles.lockOverlay} pointerEvents="none"><Feather name="lock" size={13} color={colors.textTertiary} /></View>}
        {isNew && unlocked && <View style={styles.newBadge}><Text style={styles.newBadgeText}>¡NUEVO!</Text></View>}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper:      { width: '47%', margin: '1.5%' },
  card:         { borderRadius: 16, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, overflow: 'hidden', position: 'relative', minHeight: 158 },
  glow:         { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 22, zIndex: 0 },
  particleLayer:{ position: 'absolute', top: '40%', left: '50%', width: 0, height: 0 },
  particle:     { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  iconBox:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  legendaryBorder: { borderWidth: 2, borderColor: '#FCD34D' },
  rarityBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, zIndex: 1 },
  rarityText:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  title:        { fontSize: 12, fontWeight: '700', textAlign: 'center', zIndex: 1 },
  desc:         { fontSize: 10, textAlign: 'center', lineHeight: 14, zIndex: 1 },
  xpRow:        { flexDirection: 'row', alignItems: 'center', gap: 3, zIndex: 1 },
  xpText:       { fontSize: 10, fontWeight: '700' },
  lockOverlay:  { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  newBadge:     { position: 'absolute', top: 6, right: 6, backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, zIndex: 3 },
  newBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});
