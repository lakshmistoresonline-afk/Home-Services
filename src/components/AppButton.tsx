import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useTheme } from '@/src/theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
  testID,
}: AppButtonProps) {
  const { colors, spacing, radius, typography, animations } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          background: colors.surfaceTint,
          text: colors.primary,
        };
      case 'outline':
        return {
          background: 'transparent',
          text: colors.primary,
          border: colors.primary,
        };
      case 'danger':
        return {
          background: colors.danger,
          text: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          background: colors.primary,
          text: '#FFFFFF',
        };
    }
  };

  const themeVariant = getVariantStyles();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: themeVariant.background,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: (disabled || loading) ? 0.6 : 1,
          transform: [{ scale: pressed ? animations.scale.pressed : 1 }],
          borderColor: themeVariant.border || 'transparent',
          borderWidth: themeVariant.border ? 1 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={themeVariant.text} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            typography.label.large,
            { color: themeVariant.text },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  text: {
    textAlign: 'center',
    fontWeight: '600',
  },
});
