import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Platform, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  circle?: boolean;
}

export function Skeleton({
  width,
  height,
  borderRadius,
  style,
  circle = false,
}: SkeletonProps) {
  const { colors, radius, animations } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: animations.duration.slow,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: animations.duration.slow,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, [animations.duration.slow, opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width || '100%',
          height: height || 20,
          borderRadius: circle ? 9999 : (borderRadius ?? radius.sm),
          backgroundColor: colors.surfaceTint,
          opacity
        },
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
