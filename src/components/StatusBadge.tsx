import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusColors, useTheme } from '@/src/theme';
import { listStatuses } from '@/src/api';

export function StatusBadge({ status, testID }: { status: string; testID?: string }) {
  const { spacing, radius, typography } = useTheme();
  const [color, setColor] = useState((statusColors as Record<string, string>)[status] || '#64748B');

  useEffect(() => {
    // Attempt to get dynamic color from Firestore if not in theme
    if (!(status in statusColors)) {
      listStatuses().then(list => {
        const found = list.find(s => s.name === status);
        if (found && found.color) {
          setColor(found.color);
        }
      });
    }
  }, [status]);

  return (
    <View
      testID={testID || `status-badge-${status.toLowerCase().replace(/\s+/g, '-')}`}
      style={[
        styles.wrap,
        {
          backgroundColor: color + '15',
          borderRadius: radius.full,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm + 4,
          borderColor: color + '33',
          borderWidth: 1,
        }
      ]}
    >
      <Text
        style={[
          styles.text,
          typography.label.small,
          { color, fontWeight: '700' }
        ]}
        numberOfLines={1}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
});
