import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { THEME } from '../../constants/theme';
import { Icon } from './Icon';

interface PremiumLockProps {
  /** Título corto de la función bloqueada, ej. "Simulador financiero" */
  title: string;
  /** Explica qué desbloquea Premium en esta función, en 1-2 frases */
  description: string;
  /** Navega a la pantalla Premium */
  onUpgrade: () => void;
  /** "Ahora no" — normalmente vuelve a la pantalla anterior. Si se omite, no se muestra. */
  onDismiss?: () => void;
  style?: any;
}

/**
 * Bloqueo elegante y reutilizable para funciones Premium.
 * Úsalo como cuerpo completo de una pantalla (early return antes del contenido real)
 * cuando `!premium.isPremium`.
 */
export const PremiumLock: React.FC<PremiumLockProps> = ({
  title,
  description,
  onUpgrade,
  onDismiss,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[s.wrap, style]}>
      <View style={[s.card, { backgroundColor: colors.card }]}>
        <View style={[s.iconCircle, { backgroundColor: colors.primaryLight }]}>
          <Icon name="lock" size={26} color={colors.primary} />
        </View>

        <View style={[s.badge, { backgroundColor: colors.primary }]}>
          <Icon name="zap" size={10} color="#fff" />
          <Text style={s.badgeText}>PREMIUM</Text>
        </View>

        <Text style={[s.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[s.desc, { color: colors.textSecondary }]}>{description}</Text>

        <TouchableOpacity
          onPress={onUpgrade}
          style={[s.primaryBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>Conocer Premium</Text>
          <Icon name="arrow-right" size={15} color="#fff" />
        </TouchableOpacity>

        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={s.dismissBtn} hitSlop={8}>
            <Text style={[s.dismissText, { color: colors.textTertiary }]}>Ahora no</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: THEME.radius.card,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', borderRadius: 14, paddingVertical: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  dismissBtn: { marginTop: 14, paddingVertical: 6 },
  dismissText: { fontSize: 13, fontWeight: '600' },
});

export default PremiumLock;
