import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

let showFn: ((msg: string, type?: ToastType) => void) | null = null;

export function showToast(msg: string, type: ToastType = 'info') {
  if (showFn) showFn(msg, type);
}

export function ToastHost() {
  const [msg, setMsg] = React.useState('');
  const [type, setType] = React.useState<ToastType>('info');
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const timer = useRef<any>(null);

  useEffect(() => {
    showFn = (m: string, t: ToastType = 'info') => {
      setMsg(m);
      setType(t);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web', easing: Easing.out(Easing.quad) }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(''));
      }, 2600);
    };
    return () => {
      showFn = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!msg) return null;
  const bg = type === 'error' ? '#DC2626' : type === 'success' ? '#10B981' : '#0F172A';
  const icon = type === 'error' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, backgroundColor: bg }]} testID="toast">
      <Ionicons name={icon as any} size={20} color="#fff" />
      <Text style={styles.text} numberOfLines={3}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: '#fff', flex: 1, fontSize: 14, fontWeight: '600' },
});
