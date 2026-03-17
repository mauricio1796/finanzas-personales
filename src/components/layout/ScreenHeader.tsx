import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../state/ThemeContext';
import { BackButton } from '../ui/BackButton';
import { Icon } from '../ui/Icon';
import type { FeatherName } from '../ui/Icon';

interface RightAction {
  icon: FeatherName;
  onPress: () => void;
  badge?: boolean;
}

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  rightActions?: RightAction[];
  backgroundColor?: string;
  textColor?: string;
  subtitle?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightActions,
  backgroundColor,
  textColor,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const bg         = backgroundColor ?? colors.card;
  const color      = textColor       ?? colors.textPrimary;
  const hasColorBg = !!backgroundColor;

  return (
    <View style={[
      s.container,
      {
        backgroundColor: bg,
        paddingTop: insets.top + 12,
        borderBottomWidth: hasColorBg ? 0 : 0.5,
        borderBottomColor: colors.border,
      },
    ]}>
      <View style={s.row}>
        <BackButton onPress={onBack} color={color} />

        <Text style={[s.title, { color }]} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        <View style={s.rightRow}>
          {rightActions?.map((action, i) => (
            <TouchableOpacity
              key={i}
              onPress={action.onPress}
              style={[
                s.actionBtn,
                { backgroundColor: hasColorBg ? 'rgba(255,255,255,0.2)' : colors.cardSecondary },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={action.icon} size={16} color={color} />
              {action.badge && (
                <View style={[s.badge, { backgroundColor: colors.expense }]} />
              )}
            </TouchableOpacity>
          ))}
          {(!rightActions || rightActions.length === 0) && (
            <View style={{ width: 34 }} />
          )}
        </View>
      </View>

      {subtitle && <View style={{ marginTop: 8 }}>{subtitle}</View>}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  rightRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
