import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '@/src/theme';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function AppCard({
  children,
  style,
  elevation = 'sm',
  padding = 'md',
}: AppCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing[padding],
          ...shadows[elevation],
          // Ensure android shadow works
          elevation: shadows[elevation].elevation,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease-in-out',
        backdropFilter: 'blur(8px)',
      } as any,
    }),
  },
});
