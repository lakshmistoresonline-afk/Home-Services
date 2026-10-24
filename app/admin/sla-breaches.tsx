import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { adminList, type Complaint, slaUtils } from '@/src/api';
import { AppCard } from '@/src/components/AppCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { SLAProgressBar } from '@/src/components/SLAProgressBar';
import { showToast } from '@/src/components/Toast';
import { EmptyState } from '@/src/components/EmptyState';

export default function WardSlaBreaches() {
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    compliance: 0,
    breaches: 0,
    critical: 0,
    staffPerformance: [] as any[]
  });

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await adminList({ pageSize: 1000 });
      const all = res?.items || [];
      setItems(all);

      const slaDetails = all.map(c => slaUtils.getSLADetails(c));
      const breaches = slaDetails.filter(s => s.isBreached).length;
      const critical = slaDetails.filter(s => s.warningLevel === 'DARK_RED').length;
      const resolved = all.filter(c => ['Resolved', 'Closed'].includes(c.status));
      const withinSla = resolved.filter(c => !slaUtils.isBreached(c)).length;

      // Staff Performance Leaderboard for the Ward
      const staffMap: Record<string, { name: string, total: number, breaches: number }> = {};
      all.forEach(c => {
        if (!c.assignedStaffId) return;
        if (!staffMap[c.assignedStaffId]) staffMap[c.assignedStaffId] = { name: c.assignedStaffName || 'Unknown', total: 0, breaches: 0 };
        staffMap[c.assignedStaffId].total++;
        if (slaUtils.isBreached(c)) staffMap[c.assignedStaffId].breaches++;
      });

      const staffPerf = Object.entries(staffMap).map(([id, data]) => ({
        id,
        name: data.name,
        rate: ((data.total - data.breaches) / data.total) * 100
      })).sort((a, b) => b.rate - a.rate);

      setStats({
        compliance: resolved.length > 0 ? (withinSla / resolved.length) * 100 : 100,
        breaches,
        critical,
        staffPerformance: staffPerf.slice(0, 5)
      });
    } catch (e: any) {
      showToast('Failed to load SLA data', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const breachedItems = items.filter(c => slaUtils.isBreached(c));

  const goHome = () => {
    router.replace('/admin');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.title.large, { color: colors.text, fontWeight: '800' }]}>SLA Breaches</Text>
        <TouchableOpacity onPress={goHome} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="home-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatWidget label="Compliance" value={`${Math.round(stats.compliance)}%`} color={colors.success} />
          <StatWidget label="Total Breaches" value={stats.breaches} color={colors.danger} />
          <StatWidget label="Critical" value={stats.critical} color="#7F1D1D" />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={breachedItems}
          keyExtractor={(i) => i.complaint_id}
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No active breaches"
              description="Excellent! Your ward currently has no complaints exceeding their SLA."
              icon="checkmark-done-circle-outline"
            />
          }
          ListHeaderComponent={
            stats.staffPerformance.length > 0 ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={[typography.label.large, { color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md }]}>STAFF PERFORMANCE (SLA RATE)</Text>
                <AppCard elevation="sm" padding="lg">
                  {stats.staffPerformance.map(s => (
                    <View key={s.id} style={styles.chartRow}>
                      <Text style={[typography.label.medium, { color: colors.text, width: 80 }]} numberOfLines={1}>{s.name}</Text>
                      <View style={[styles.barContainer, { backgroundColor: colors.surfaceTint }]}>
                        <View style={[styles.bar, { width: `${s.rate}%`, backgroundColor: s.rate > 80 ? colors.success : colors.warning }]} />
                      </View>
                      <Text style={[typography.label.medium, { color: colors.textSecondary, width: 40, textAlign: 'right' }]}>{Math.round(s.rate)}%</Text>
                    </View>
                  ))}
                </AppCard>
                <Text style={[typography.label.large, { color: colors.textSecondary, letterSpacing: 1.5, marginTop: spacing.lg, marginBottom: spacing.md }]}>ACTIVE BREACHES</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const sla = slaUtils.getSLADetails(item);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/complaint/${item.complaint_id}`)}
                activeOpacity={0.85}
              >
                <AppCard padding="md" elevation="sm">
                  <View style={styles.cardHead}>
                    <Text style={[typography.label.small, { color: colors.textSecondary, letterSpacing: 1, fontWeight: '700' }]}>{item.complaint_id}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.sm, fontWeight: '700' }]}>{item.title}</Text>

                  <View style={[styles.slaInfo, { backgroundColor: colors.surfaceTint }]}>
                    <View style={[styles.levelTag, { backgroundColor: sla.warningLevel === 'DARK_RED' ? '#7F1D1D' : colors.danger }]}>
                      <Text style={[typography.label.small, { color: '#fff', fontWeight: '900' }]}>{sla.statusLabel.toUpperCase()}</Text>
                    </View>
                    <Text style={[typography.label.large, { color: colors.danger, fontWeight: '800' }]}>{Math.round(sla.overdueHours)}h OVERDUE</Text>
                  </View>

                  <View style={styles.footer}>
                     <View style={styles.staff}>
                        <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                        <Text style={[typography.body.small, { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' }]}>{item.assignedStaffName || 'Unassigned'}</Text>
                     </View>
                     <Text style={[typography.body.small, { color: colors.textSecondary }]}>Due {dayjs(item.slaDueAt?.toDate?.() || item.slaDueAt).format('MMM D')}</Text>
                  </View>
                </AppCard>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </SafeAreaView>
  );
}

function StatWidget({ label, value, color }: any) {
  const { colors, typography, spacing } = useTheme();
  return (
    <AppCard style={styles.statWidget} elevation="sm" padding="md">
      <Text style={[typography.headline.small, { color, fontWeight: '800' }]}>{value}</Text>
      <Text style={[typography.label.small, { color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '800' }]}>{label.toUpperCase()}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { gap: 12, paddingHorizontal: 24, marginVertical: 8, paddingBottom: 16 },
  statWidget: { minWidth: 120, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  barContainer: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slaInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 12 },
  levelTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  staff: { flexDirection: 'row', alignItems: 'center' }
});
