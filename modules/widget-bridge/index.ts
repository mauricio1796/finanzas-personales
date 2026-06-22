import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const WidgetBridge = Platform.OS === 'ios'
  ? requireOptionalNativeModule('WidgetBridge')
  : null;

/**
 * Escribe los datos financieros al App Group compartido con el widget iOS
 * y dispara la recarga del timeline de WidgetKit.
 * No-op en Android y web (sin error).
 */
export async function updateWidgetNative(json: string): Promise<void> {
  if (!WidgetBridge) return;
  await WidgetBridge.updateWidget(json);
}
