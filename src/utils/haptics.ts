import { Platform } from 'react-native';

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  try {
    // Graceful haptic feedback fallback for native mobile devices
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(type === 'heavy' ? 40 : type === 'medium' ? 25 : 15);
    }
  } catch (e) {
    /* non-blocking haptic notice */
  }
};
