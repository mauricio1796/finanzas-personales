import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

const SWIPE_THRESHOLD = -55;
const DELETE_WIDTH    = 68;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete }) => {
  const translateX  = useRef(new Animated.Value(0)).current;
  const rowOpen     = useRef(false);
  const deleteScale = useRef(new Animated.Value(1)).current;

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
    Animated.sequence([
      Animated.timing(deleteScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(deleteScale, { toValue: 1,   duration: 80,  useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(translateX, {
        toValue: -400,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDelete());
    });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRow}>
        {children}
        <TouchableOpacity onPress={onDelete} style={styles.webDelete} activeOpacity={0.6}>
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Delete zone */}
      <View style={styles.deleteAction}>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
            <Feather name="trash-2" size={18} color="#fff" />
          </Animated.View>
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
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
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
