import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BOTTOM_NAV_H = 56;

export function useBottomPadding(extra = 0): number {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_H + insets.bottom + extra;
}
