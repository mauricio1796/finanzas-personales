/**
 * ConsentCheckbox — casilla de autorización con enlace al documento.
 * Nunca viene marcada por defecto (una casilla pre-marcada no es un
 * consentimiento expreso). Accesible: rol checkbox y estado anunciado.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';

interface Props {
  checked: boolean;
  onToggle: () => void;
  /** Texto antes del enlace. */
  label: string;
  /** Texto del enlace (opcional). */
  linkLabel?: string;
  onLinkPress?: () => void;
  /** Texto después del enlace. */
  labelAfter?: string;
  required?: boolean;
  testID?: string;
}

export function ConsentCheckbox({
  checked, onToggle, label, linkLabel, onLinkPress, labelAfter, required, testID,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={s.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${label}${linkLabel ? ` ${linkLabel}` : ''}${labelAfter ?? ''}${required ? ' (obligatorio)' : ' (opcional)'}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          s.box,
          { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : colors.inputBg },
        ]}
        testID={testID}
      >
        {checked && <Icon name="check" size={14} color="#FFFFFF" />}
      </Pressable>
      <Text style={[s.text, { color: colors.textSecondary }]} onPress={onToggle}>
        {label}
        {linkLabel ? (
          <Text
            style={[s.link, { color: colors.primary }]}
            onPress={onLinkPress}
            accessibilityRole="link"
            suppressHighlighting
          >
            {` ${linkLabel}`}
          </Text>
        ) : null}
        {labelAfter ?? ''}
        <Text style={{ color: required ? colors.expense : colors.textTertiary }}>
          {required ? ' *' : ' (opcional)'}
        </Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  box:  { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
