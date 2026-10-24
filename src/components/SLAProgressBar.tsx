import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type SLADetails, type SLAWarningLevel } from '@/src/api/slaUtils';
import { useTheme } from '../theme';

interface Props {
  details: SLADetails;
  height?: number;
  showLabel?: boolean;
}

export function SLAProgressBar({ details, height = 6, showLabel = false }: Props) {
  const { colors, typography, radius } = useTheme();

  const getColor = (level: SLAWarningLevel) => {
    switch (level) {
      case 'GREEN': return colors.success;
      case 'YELLOW': return colors.warning;
      case 'ORANGE': return '#EA580C';
      case 'RED': return colors.danger;
      case 'DARK_RED': return '#7F1D1D';
      default: return colors.textSecondary;
    }
  };

  const color = getColor(details.warningLevel);

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.statusText, { color, ...typography.label.small, fontWeight: '800' }]}>
            {details.statusLabel.toUpperCase()}
          </Text>
          <Text style={[styles.percentText, { color: colors.textSecondary, ...typography.label.small }]}>
            {Math.round(details.percentageUsed)}%
          </Text>
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor: color + '15', borderRadius: radius.full }]}>
        <View
          style={[
            styles.progress,
            {
              width: `${Math.min(100, details.percentageUsed)}%`,
              backgroundColor: color,
              borderRadius: radius.full
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginVertical: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  statusText: { letterSpacing: 0.8 },
  percentText: { fontWeight: '700' },
  track: { width: '100%', overflow: 'hidden' },
  progress: { height: '100%' }
});
