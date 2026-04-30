import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { THEME } from '../../constants/theme';

const SWIPE_THRESHOLD = -60;
const DELETE_WIDTH    = 72;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpen    = useRef(false);

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start(() => {
      rowOpen.current = false;
    });
  };

  const open = () => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      friction: 8,
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
        const val = Math.min(0, Math.max(-DELETE_WIDTH, g.dx));
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
    // Animate row out, then call onDelete
    Animated.timing(translateX, {
      toValue: -400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  if (Platform.OS === 'web') {
    // On web, just show a trash button inline (no PanResponder swipe)
    return (
      <View style={styles.webRow}>
        {children}
        <TouchableOpacity onPress={onDelete} style={styles.webDelete}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Delete button behind the row */}
      <View style={styles.deleteAction}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteIcon}>🗑</Text>
          <Text style={styles.deleteLabel}>Borrar</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable content */}
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
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    backgroundColor: THEME.colors.expense,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    alignItems: 'center',
    gap: 2,
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteLabel: {
    fontSize: 10,
    color: THEME.colors.surface,
    fontWeight: '700',
  },

  // Web fallback
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webDelete: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
