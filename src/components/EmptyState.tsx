import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.prototype.name;
  title: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
}

export function EmptyState({
  icon = 'search-outline',
  title,
  description,
  onReset,
  resetLabel = 'Reset Filters',
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceTint }]}>
        <Ionicons name={icon as any} size={48} color={colors.textSecondary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      )}
      {onReset && (
        <TouchableOpacity
          onPress={onReset}
          style={[styles.resetBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.resetBtnText}>{resetLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  resetBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  resetBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
