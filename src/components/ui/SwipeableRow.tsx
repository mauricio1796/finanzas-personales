import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../state/ThemeContext';

const SWIPE_THRESHOLD = -40;
const ACTION_WIDTH    = 60;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

/**
 * Fila deslizable con una acción de eliminar discreta: un botón circular
 * pequeño en rojo suave (no un bloque rojo sólido). Al tocarlo la fila vuelve
 * a su sitio y se pide confirmación; si el usuario cancela, nada se mueve.
 */
export const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete }) => {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpen    = useRef(false);

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 9 }).start(() => {
      rowOpen.current = false;
    });
  };

  const open = () => {
    Animated.spring(translateX, {
      toValue: -ACTION_WIDTH,
      useNativeDriver: true,
      friction: 9,
    }).start(() => {
      rowOpen.current = true;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderGrant: () => {
        translateX.setOffset((translateX as any)._value);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        const val = Math.min(0, Math.max(-ACTION_WIDTH, g.dx));
        translateX.setValue(val);
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        if (g.dx < SWIPE_THRESHOLD) {
          open();
        } else {
          close();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    close();
    onDelete();
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRow}>
        {children}
        <TouchableOpacity
          onPress={onDelete}
          style={styles.webDelete}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Eliminar registro"
        >
          <Feather name="trash-2" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Acción de eliminar */}
      <View style={styles.actionZone}>
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.actionBtn, { backgroundColor: colors.dangerLight }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Eliminar registro"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Contenido deslizable */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity activeOpacity={1} onPress={rowOpen.current ? close : undefined}>
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Web fallback
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webDelete: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
