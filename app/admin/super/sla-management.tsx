import React, { useCallback, useState } from 'react';
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
import isToday from 'dayjs/plugin/isToday';
import { useTheme } from '@/src/theme';
import { adminList, slaUtils, type Complaint } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { SLAProgressBar } from '@/src/components/SLAProgressBar';
import { showToast } from '@/src/components/Toast';
import { EmptyState } from '@/src/components/EmptyState';

dayjs.extend(isToday);

export default function SuperSlaManagement() {
  const { colors } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overallCompliance: 0,
    totalBreaches: 0,
    criticalBreaches: 0,
    dueToday: 0,
    dueTomorrow: 0,
    wardPerformance: [] as any[]
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminList({ pageSize: 1000 });
      const all = res?.items || [];
      setItems(all);

      const slaDetails = all.map(c => slaUtils.getSLADetails(c));
      const breaches = slaDetails.filter(s => s.isBreached).length;
      const critical = slaDetails.filter(s => s.warningLevel === 'DARK_RED').length;
      const dueToday = all.filter(c => dayjs(c.slaDueAt?.toDate?.() || c.slaDueAt).isToday()).length;
      const dueTomorrow = all.filter(c => dayjs(c.slaDueAt?.toDate?.() || c.slaDueAt).add(1, 'day').isToday()).length;

      const resolved = all.filter(c => ['Resolved', 'Closed'].includes(c.status));
      const withinSla = resolved.filter(c => !slaUtils.isBreached(c)).length;

      // Group by Ward
      const wards: Record<number, { total: number, breaches: number }> = {};
      all.forEach(c => {
        if (!wards[c.wardNumber]) wards[c.wardNumber] = { total: 0, breaches: 0 };
        wards[c.wardNumber].total++;
        if (slaUtils.isBreached(c)) wards[c.wardNumber].breaches++;
      });

      const wardPerf = Object.entries(wards).map(([ward, data]) => ({
        ward: `Ward ${ward}`,
        rate: ((data.total - data.breaches) / data.total) * 100,
      })).sort((a, b) => a.rate - b.rate);

      setStats({
        overallCompliance: resolved.length > 0 ? (withinSla / resolved.length) * 100 : 100,
        totalBreaches: breaches,
        criticalBreaches: critical,
        dueToday,
        dueTomorrow,
        wardPerformance: wardPerf.slice(0, 5)
      });
    } catch (e) {
      showToast('Failed to load global SLA data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const breachedItems = items.filter(c => slaUtils.isBreached(c));

  const goHome = () => {
    router.replace('/admin/super');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Global SLA Monitor</Text>
        <TouchableOpacity onPress={goHome}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ maxHeight: 110 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsGrid}>
           <GlobalStat label="Compliance" value={`${Math.round(stats.overallCompliance)}%`} color="#10B981" />
           <GlobalStat label="Total Breaches" value={stats.totalBreaches} color="#EF4444" />
           <GlobalStat label="Critical" value={stats.criticalBreaches} color="#7F1D1D" />
           <GlobalStat label="Due Today" value={stats.dueToday} color="#F59E0B" />
           <GlobalStat label="Due Tomorrow" value={stats.dueTomorrow} color="#3B82F6" />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 10, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        >
          <Text style={styles.sectionTitle}>UNDERPERFORMING WARDS (SLA RATE)</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {stats.wardPerformance.map(w => (
              <View key={w.ward} style={styles.chartRow}>
                <Text style={[styles.chartLabel, { color: colors.text }]} numberOfLines={1}>{w.ward}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: `${w.rate}%`, backgroundColor: w.rate < 50 ? '#EF4444' : '#F59E0B' }]} />
                </View>
                <Text style={[styles.chartVal, { color: colors.textSecondary }]}>{Math.round(w.rate)}%</Text>
              </View>
            ))}
            {stats.wardPerformance.length === 0 && (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>No ward data available</Text>
            )}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SLA COMPLAINT QUEUE (BY DELAY)</Text>

          {breachedItems.length === 0 ? (
            <EmptyState
              title="No active breaches"
              description="Excellent! All complaints are within their SLA deadlines."
              icon="checkmark-circle-outline"
            />
          ) : (
            breachedItems
              .sort((a, b) => slaUtils.getSLADetails(b).overdueHours - slaUtils.getSLADetails(a).overdueHours)
              .slice(0, 15)
              .map(item => {
                const sla = slaUtils.getSLADetails(item);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(`/complaint/${item.complaint_id}`)}
                    activeOpacity={0.85}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}
                  >
                    <View style={styles.cardHeader}>
                       <View>
                          <Text style={[styles.cid, { color: colors.textSecondary }]}>{item.complaint_id}</Text>
                          <Text style={[styles.ward, { color: colors.primary }]}>Ward {item.wardNumber} · {item.departmentName}</Text>
                       </View>
                       <StatusBadge status={item.status} />
                    </View>

                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>

                    <SLAProgressBar details={sla} showLabel height={6} />

                    <View style={styles.meta}>
                       <View style={styles.metaItem}>
                          <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.metaText}>{item.assignedStaffName || 'NOT ASSIGNED'}</Text>
                       </View>
                       <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '800' }}>
                         {Math.floor(sla.overdueHours / 24)}d {Math.round(sla.overdueHours % 24)}h LATE
                       </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GlobalStat({ label, value, color }: any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.globalStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
       <Text style={[styles.gsVal, { color }]}>{value}</Text>
       <Text style={styles.gsLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  statsGrid: { gap: 12, paddingHorizontal: 24, marginVertical: 8, paddingBottom: 10 },
  globalStat: { minWidth: 130, padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  gsVal: { fontSize: 22, fontWeight: '800' },
  gsLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', marginTop: 4, letterSpacing: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1.5, marginBottom: 12 },
  chartCard: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartLabel: { width: 70, fontSize: 11, fontWeight: '700' },
  barContainer: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  chartVal: { width: 35, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  card: { padding: 16, borderRadius: 20, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cid: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ward: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  itemTitle: { fontSize: 14, fontWeight: '700', marginVertical: 10 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#64748B', fontWeight: '600' }
});
