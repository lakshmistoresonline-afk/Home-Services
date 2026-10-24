import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { type Complaint, slaUtils } from '@/src/api';
import { SLAProgressBar } from './SLAProgressBar';
import { useTheme } from '../theme';
import { AppCard } from './AppCard';

interface Props {
  complaint: Complaint;
}

const InfoRow = ({ label, value, icon, colors, color, typography }: any) => (
  <View style={styles.infoRow}>
    <View style={styles.labelGroup}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={[styles.label, { color: colors.textSecondary, ...typography.label.medium }]}>{label}</Text>
    </View>
    <Text style={[styles.value, { color: color || colors.text, ...typography.body.medium, fontWeight: '700' }]}>{value}</Text>
  </View>
);

export function SLAInfoPanel({ complaint }: Props) {
  const { colors, spacing, typography } = useTheme();
  const sla = slaUtils.getSLADetails(complaint);
  const durations = slaUtils.calculateDurations(complaint);

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text, ...typography.title.small, fontWeight: '800' }]}>SLA Performance</Text>
      </View>

      <SLAProgressBar details={sla} showLabel height={8} />

      <View style={[styles.grid, { marginTop: spacing.md }]}>
        <InfoRow
          label="Deadline"
          value={dayjs(complaint.slaDueAt?.toDate?.() || complaint.slaDueAt).format('MMM D, h:mm A')}
          icon="calendar-outline"
          colors={colors}
          typography={typography}
        />

        {sla.isBreached ? (
          <InfoRow
            label="Overdue By"
            value={`${Math.floor(sla.overdueHours / 24)}d ${Math.round(sla.overdueHours % 24)}h`}
            icon="alert-circle-outline"
            color={colors.danger}
            colors={colors}
            typography={typography}
          />
        ) : (
          <InfoRow
            label="Time Left"
            value={`${Math.floor(sla.timeRemainingHours / 24)}d ${Math.round(sla.timeRemainingHours % 24)}h`}
            icon="hourglass-outline"
            color={colors.success}
            colors={colors}
            typography={typography}
          />
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <InfoRow
          label="Assignment"
          value={durations.assignmentDuration ? `${durations.assignmentDuration.toFixed(1)}h` : 'Pending'}
          icon="person-add-outline"
          colors={colors}
          typography={typography}
        />
        <InfoRow
          label="Resolution"
          value={durations.resolutionDuration ? `${durations.resolutionDuration.toFixed(1)}h` : 'In Progress'}
          icon="checkmark-done-outline"
          colors={colors}
          typography={typography}
        />

        {durations.verificationDuration && (
          <InfoRow
            label="Verification"
            value={`${durations.verificationDuration.toFixed(1)}h`}
            icon="shield-checkmark-outline"
            colors={colors}
            typography={typography}
          />
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { letterSpacing: 0.2 },
  grid: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {},
  value: {},
  divider: { height: 1, marginVertical: 6 }
});
