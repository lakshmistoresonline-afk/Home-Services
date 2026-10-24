import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/src/theme';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
}

export function AppInput({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  ...props
}: AppInputProps) {
  const { colors, spacing, radius, typography, animations } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            typography.label.medium,
            { color: isFocused ? colors.primary : colors.textSecondary },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceTint,
            borderRadius: radius.md,
            borderColor: error ? colors.danger : isFocused ? colors.primary : colors.border,
            borderWidth: isFocused || error ? 2 : 1,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            typography.body.large,
            { color: colors.text },
            inputStyle,
          ]}
          placeholderTextColor={colors.textSecondary + '88'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </View>
      {error && (
        <Text
          style={[
            styles.error,
            typography.label.small,
            { color: colors.danger, marginTop: spacing.xs },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  inputContainer: {
    height: 52,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 8,
  },
  error: {
    marginLeft: 4,
  },
});
