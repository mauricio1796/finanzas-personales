import { useRef } from 'react';
import { PanResponder, Animated, Dimensions } from 'react-native';

const SCREEN_W       = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_W * 0.35;
const EDGE_WIDTH      = 30;

export function useSwipeBack(onBack: () => void, enabled = true) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return enabled && evt.nativeEvent.pageX < EDGE_WIDTH;
      },
      onMoveShouldSetPanResponder: (_, gs) => {
        return enabled && gs.dx > 10 && Math.abs(gs.dy) < 50;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: SCREEN_W,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onBack();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            tension: 100,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return { panResponder, translateX };
}
