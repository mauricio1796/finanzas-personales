import { RefObject } from 'react';
import { View } from 'react-native';

export interface TourMeasure { x: number; y: number; width: number; height: number; }

const _refs = new Map<string, RefObject<View>>();

export const TourRegistry = {
  register(key: string, ref: RefObject<View>): void {
    _refs.set(key, ref);
  },

  unregister(key: string): void {
    _refs.delete(key);
  },

  measure(key: string): Promise<TourMeasure | null> {
    const ref = _refs.get(key);
    if (!ref?.current) return Promise.resolve(null);
    return new Promise(resolve => {
      (ref.current as any).measureInWindow((x: number, y: number, w: number, h: number) => {
        if (w > 0 && h > 0) resolve({ x, y, width: w, height: h });
        else resolve(null);
      });
    });
  },
};
