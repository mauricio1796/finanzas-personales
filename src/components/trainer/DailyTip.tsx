import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { StorageService } from '@/services/StorageService';

interface DailyTipProps {
  tips?: string[];
  customMessage?: string;
}

const DEFAULT_TIPS = [
  '💡 Comienza el día revisando tu presupuesto establecido para el mes.',
  '📊 Analiza tus gastos del mes anterior para identificar áreas de mejora.',
  '🎯 Define un objetivo financiero específico y medible para este mes.',
  '💰 Construye un fondo de emergencia con 3 a 6 meses de gastos.',
  '📱 Usa aplicaciones para rastrear tus gastos diarios con precisión.',
  '🚫 Evita compras impulsivas esperando 24 horas antes de comprar algo.',
  '🏦 Considera invertir una parte de tus ahorros para el crecimiento.',
  '📉 Revisa tus suscripciones mensuales y cancela las que no uses.',
  '🍔 Planifica tus comidas para reducir gastos en alimentos.',
  '🎁 El regalo más valioso es la estabilidad financiera para tu familia.',
];

export const DailyTip: React.FC<DailyTipProps> = ({
  tips = DEFAULT_TIPS,
  customMessage,
}) => {
  const [currentTip, setCurrentTip] = useState('');
  const [tipIndex, setTipIndex] = useState(0);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    loadTip();
  }, []);

  const loadTip = async () => {
    try {
      const today = new Date().toDateString();
      const lastTipDate = await StorageService.getValue('lastTipDate');
      const lastTipIndex = await StorageService.getValue('lastTipIndex');

      let newIndex = 0;

      if (lastTipDate !== today) {
        // It's a new day
        newIndex = (parseInt(lastTipIndex || '0') + 1) % tips.length;
        await StorageService.saveValue('lastTipDate', today);
        await StorageService.saveValue('lastTipIndex', newIndex.toString());
        setIsNew(true);
      } else {
        newIndex = parseInt(lastTipIndex || '0');
      }

      setTipIndex(newIndex);
      setCurrentTip(tips[newIndex]);
    } catch (error) {
      console.error('Error loading tip:', error);
      setCurrentTip(tips[0]);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `💡 Consejo financiero del día:\n\n${currentTip}\n\n📱 Descarga FinancyAI para más consejos`,
        title: 'Consejo Financiero',
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('No se pudo compartir el consejo');
    }
  };

  const handleNextTip = () => {
    const nextIndex = (tipIndex + 1) % tips.length;
    setTipIndex(nextIndex);
    setCurrentTip(tips[nextIndex]);
    setIsNew(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        {isNew && <Text style={styles.badgeText}>NUEVO</Text>}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>💡</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Consejo del Día</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        <Text style={styles.tipText}>{customMessage || currentTip}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleNextTip}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>Siguiente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            style={[styles.actionButton, styles.shareButton]}
            activeOpacity={0.7}
          >
            <Text style={styles.shareButtonText}>Compartir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.background,
    letterSpacing: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  date: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textTransform: 'capitalize',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  shareButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.background,
  },
});
