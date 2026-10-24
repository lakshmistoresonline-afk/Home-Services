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
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderColor: 'rgba(0,0,0,0.05)',
  },
});
