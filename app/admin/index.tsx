import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db, auth } from '@/src/config/firebase';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../src/context/auth';
import { adminList, adminStats, meta, listCorporationStaff, getPerformanceMetrics, slaUtils, assignmentEngine, type Complaint, type User } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { AppCard } from '@/src/components/AppCard';
import { SLAProgressBar } from '@/src/components/SLAProgressBar';
import { PickerSheet } from '@/src/components/PickerSheet';
import { Skeleton } from '@/src/components/Skeleton';
import { EmptyState } from '@/src/components/EmptyState';
import { showToast } from '@/src/components/Toast';

dayjs.extend(isToday);

const STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const SLA_FILTERS = ['Due Today', 'Near SLA', 'Breached', 'Critical'];

const ComplaintListItem = React.memo(({ item, onPress }: { item: Complaint, onPress: () => void }) => {
  const { colors, typography, spacing } = useTheme();
  const sla = slaUtils.getSLADetails(item);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <AppCard padding="md" elevation="sm">
        <View style={styles.topRow}>
          <Text style={[typography.label.small, { color: colors.textSecondary, letterSpacing: 1.2, fontWeight: '700' }]}>
            {item.complaint_id}
          </Text>
          <StatusBadge status={item.status} />
        </View>

        <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.sm, fontWeight: '700' }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={{ marginTop: spacing.md }}>
          <SLAProgressBar details={sla} height={6} />
          <View style={styles.slaDetails}>
            <Text style={[typography.label.small, { color: sla.isBreached ? colors.danger : colors.textSecondary, fontWeight: '700' }]}>
              {sla.isBreached ? `OVERDUE: ${Math.round(sla.overdueHours)}h` : `REMAINING: ${Math.round(sla.timeRemainingHours)}h`}
            </Text>
            <Text style={[typography.label.small, { color: colors.textSecondary, fontWeight: '700' }]}>
              DUE: {dayjs(item.slaDueAt?.toDate?.() || item.slaDueAt).format('MMM D')}
            </Text>
          </View>
        </View>

        <View style={[styles.metaRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }]}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={colors.primary} />
            <Text style={[typography.body.small, { color: colors.textSecondary, fontWeight: '600' }]}>{item.citizenName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={14} color={colors.primary} />
            <Text style={[typography.body.small, { color: colors.textSecondary, fontWeight: '600' }]}>{item.departmentName}</Text>
          </View>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
});

export default function AdminDashboard() {
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { user, logout, isLoggingOut } = useAuth();
  const router = useRouter();

  const isSuper = user?.role === 'super_admin' || user?.role === 'readonly_super_admin';
  const isWardAdmin = user?.role === 'ward_admin';
  const isStaff = user?.role === 'staff';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [slaFilter, setSlaFilter] = useState<string>('');

  const [items, setItems] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [staffStats, setStaffStats] = useState({ total: 0, available: 0, busy: 0 });
  const [performance, setPerformance] = useState<any>(null);
  const [complaintStats, setStats] = useState({
    total: 0,
    submitted: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    unassigned: 0,
    assignedToday: 0,
    completedToday: 0,
    avgResolutionTime: 0,
    slaBreachedCount: 0,
    dueTodayCount: 0,
    nearSlaCount: 0,
    criticalBreachCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [showStatus, setShowStatus] = useState(false);
  const [showDept, setShowDept] = useState(false);
  const [showSla, setShowSla] = useState(false);

  // Use refs to track values needed in load but shouldn't trigger re-renders or effect loops
  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const roleLabel = useMemo(() => {
    switch (user?.role) {
      case 'super_admin':
      case 'readonly_super_admin': return 'SUPER ADMIN';
      case 'ward_admin': return `WARD ${user.wardNumber} ADMIN`;
      case 'staff': return 'FIELD STAFF DASHBOARD';
      default: return 'ADMIN DASHBOARD';
    }
  }, [user]);

  const load = useCallback(async (isMore = false) => {
    if (!user || isLoggingOut || isLoadingRef.current) return;

    // Guard for pagination
    if (isMore && (!hasMoreRef.current || loadingMore)) return;

    try {
      isLoadingRef.current = true;
      if (isMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        lastDocRef.current = null;
        hasMoreRef.current = true;
      }

      const params: any = {
        q: debouncedSearch,
        department,
        status,
        assigned_to: assignedFilter || undefined,
        lastDoc: isMore ? lastDocRef.current : undefined
      };

      const fetchAdminList = async () => {
        try {
          const res = await adminList(params);
          if (!auth.currentUser || isLoggingOut) return;

          let list = res?.items || [];

          if (slaFilter) {
            list = list.filter(c => {
              const sla = slaUtils.getSLADetails(c);
              if (slaFilter === 'Due Today') return dayjs(c.slaDueAt?.toDate?.() || c.slaDueAt).isToday();
              if (slaFilter === 'Near SLA') return sla.warningLevel === 'ORANGE';
              if (slaFilter === 'Breached') return sla.isBreached;
              if (slaFilter === 'Critical') return sla.warningLevel === 'DARK_RED';
              return true;
            });
          }

          if (isMore) {
            setItems(prev => [...prev, ...list]);
          } else {
            setItems(list);
          }

          lastDocRef.current = res?.lastDoc || null;
          hasMoreRef.current = res?.hasMore || false;
          setLastDoc(lastDocRef.current);
          setHasMore(hasMoreRef.current);

        } catch (e: any) {
          if (!isLoggingOut && auth.currentUser) {
             showToast(`Complaints: ${e.message}`, 'error');
          }
        }
      };

      const fetchAdminStats = async () => {
        try {
          const s = await adminStats();
          if (!auth.currentUser || isLoggingOut) return;
          if (s) setStats(prev => ({ ...prev, ...s }));
        } catch (e: any) { }
      };

      const fetchMeta = async () => {
        try {
          const m = await meta();
          if (!auth.currentUser || isLoggingOut) return;
          if (m?.departments) setDepartments(m.departments);
        } catch (e: any) { }
      };

      const fetchStaff = async () => {
        if (!isWardAdmin && !isSuper) return;
        try {
          const staff = await listCorporationStaff(isWardAdmin ? user?.wardNumber || undefined : undefined);
          if (!auth.currentUser || isLoggingOut) return;
          if (staff) {
            setStaffStats({
              total: staff.length,
              available: staff.filter(x => x.isActive).length,
              busy: staff.filter(x => !x.isActive).length
            });
          }
        } catch (e: any) { }
      };

      const fetchPerformance = async () => {
        if (!isStaff) return;
        try {
          const perf = await getPerformanceMetrics(user.uid);
          if (perf) setPerformance(perf);
        } catch (e) { }
      };

      const runSweep = async () => {
        if (isStaff || !user) return;
        try {
          await assignmentEngine.runMaintenanceSweep(user);
        } catch (e) {
          console.error("Maintenance sweep failed:", e);
        }
      };

      // Initial load only does list + stats
      if (!isMore) {
        await Promise.all([
          fetchAdminList(),
          fetchAdminStats(),
          fetchMeta(),
          fetchStaff(),
          fetchPerformance(),
          runSweep()
        ]);
      } else {
        await fetchAdminList();
      }

    } catch (e: any) {
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [debouncedSearch, department, status, slaFilter, assignedFilter, isWardAdmin, isSuper, isStaff, user, isLoggingOut]);

  // Initial load when screen is focused
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  // Trigger load when filters change, but NOT on initial mount (handled by useFocusEffect)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    load(false);
  }, [debouncedSearch, department, status, slaFilter, assignedFilter]);

  useEffect(() => {
    if (user && !isLoggingOut) {
      const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", user.uid),
        where("read", "==", false)
      );
      const unsubscribe = onSnapshot(q,
        (snap) => {
          if (!auth.currentUser || isLoggingOut) return;
          setUnreadCount(snap?.size || 0);
        },
        (error) => {
          if (error.code === 'permission-denied') return;
          console.error('Admin notifications listener error:', error);
        }
      );
      return () => unsubscribe();
    }
  }, [user, isLoggingOut]);

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const goHome = () => {
    if (isSuper) {
      router.replace('/admin/super');
    } else {
      router.replace('/admin');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatus('');
    setDepartment('');
    setSlaFilter('');
    setAssignedFilter('');
  };

  const activeFilters = useMemo(() => {
    return [
      status && { key: 'status', label: status, clear: () => setStatus('') },
      department && { key: 'dept', label: department, clear: () => setDepartment('') },
      slaFilter && { key: 'sla', label: slaFilter, clear: () => setSlaFilter('') },
      assignedFilter && {
        key: 'assigned',
        label: assignedFilter === 'unassigned' ? 'Unassigned' : assignedFilter === 'me' ? 'Assigned to me' : 'Assigned',
        clear: () => setAssignedFilter(''),
      },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  }, [status, department, slaFilter, assignedFilter]);

  if (!user && !loading) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        {isSuper && (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[typography.label.small, { color: colors.primary, letterSpacing: 1.5, fontWeight: '700' }]}>{roleLabel}</Text>
          <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]}>Hi, {user?.fullName?.split(' ')[0] || 'Admin'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.sm }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
          </TouchableOpacity>
          {isWardAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin/sla-breaches')}
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.sm }]}
            >
              <Ionicons name="time-outline" size={22} color={colors.warning} />
            </TouchableOpacity>
          )}
          {isSuper && (
            <TouchableOpacity
              onPress={goHome}
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.sm }]}
            >
              <Ionicons name="home-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={doLogout} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {isStaff ? (
            <>
              <StatChip label="Assigned" value={complaintStats.assigned} color={colors.primary} />
              <StatChip label="Due Today" value={complaintStats.dueTodayCount} color={colors.warning} />
              <StatChip label="Near Expiry" value={complaintStats.nearSlaCount} color="#EA580C" />
              <StatChip label="Breached" value={complaintStats.slaBreachedCount} color={colors.danger} />
            </>
          ) : (
            <>
              <StatChip label="Total" value={complaintStats.total} color={colors.primary} />
              <StatChip label="Breached" value={complaintStats.slaBreachedCount} color={colors.danger} />
              <StatChip label="Open" value={complaintStats.submitted + complaintStats.assigned + complaintStats.in_progress} color={colors.warning} />
              <StatChip label="Due Today" value={complaintStats.dueTodayCount} color="#7C3AED" />
            </>
          )}
        </ScrollView>
      </View>

      <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.surface, ...shadows.sm }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          testID="admin-search-input"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={isStaff ? "Search complaint ID or title" : "Search ID, name or staff"}
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, color: colors.text, fontSize: 16, paddingLeft: spacing.xs }}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} testID="admin-search-clear">
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity
            onPress={() => setShowStatus(true)}
            style={[styles.chip, { borderColor: status ? colors.primary : colors.border, backgroundColor: status ? colors.primary + '10' : colors.surface }]}
          >
            <Ionicons name="filter-outline" size={16} color={status ? colors.primary : colors.textSecondary} />
            <Text style={[typography.label.medium, { color: status ? colors.primary : colors.textSecondary, fontWeight: '700' }]}>{status || 'Status'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSla(true)}
            style={[styles.chip, { borderColor: slaFilter ? '#EA580C' : colors.border, backgroundColor: slaFilter ? '#EA580C10' : colors.surface }]}
          >
            <Ionicons name="time-outline" size={16} color={slaFilter ? '#EA580C' : colors.textSecondary} />
            <Text style={[typography.label.medium, { color: slaFilter ? '#EA580C' : colors.textSecondary, fontWeight: '700' }]}>{slaFilter || 'SLA Status'}</Text>
          </TouchableOpacity>
          {!isStaff && (
            <TouchableOpacity
              onPress={() => setShowDept(true)}
              style={[styles.chip, { borderColor: department ? colors.primary : colors.border, backgroundColor: department ? colors.primary + '10' : colors.surface }]}
            >
              <Ionicons name="business-outline" size={16} color={department ? colors.primary : colors.textSecondary} />
              <Text style={[typography.label.medium, { color: department ? colors.primary : colors.textSecondary, fontWeight: '700' }]}>{department || 'Department'}</Text>
            </TouchableOpacity>
          )}
          {activeFilters.map((f) => (
            <TouchableOpacity key={f.key} onPress={f.clear} style={[styles.chipClear, { borderColor: colors.border, backgroundColor: colors.surfaceTint }]}>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
              <Text style={[typography.label.small, { color: colors.textSecondary, fontWeight: '700' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={{ padding: 24 }}>
          {[1,2,3,4].map(i => (
            <Skeleton key={i} height={140} borderRadius={16} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.complaint_id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={colors.primary} />}
          onEndReached={() => load(true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <>
              {loadingMore && <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.primary} />}
              {isStaff && performance && (
                <View style={[styles.perfSection, { borderTopColor: colors.border }]}>
                  <Text style={[typography.label.large, { color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md }]}>MY PERFORMANCE</Text>
                  <View style={styles.perfGrid}>
                    <PerfCard label="SLA Compliance" value={`${Math.round(performance.slaComplianceRate)}%`} color={colors.success} />
                    <PerfCard label="Avg Resolution" value={`${performance.avgResolutionTime.toFixed(1)}h`} color={colors.primary} />
                    <PerfCard label="Resolved (30d)" value={performance.resolvedThisMonth} color={colors.primaryVariant} />
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="No complaints match"
              description="Try adjusting your filters or search term."
              onReset={resetFilters}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <ComplaintListItem
              item={item}
              onPress={() => router.push(`/complaint/${item.complaint_id}`)}
            />
          )}
        />
      )}

      <PickerSheet visible={showStatus} title="Select Status" options={['', ...STATUSES]} value={status} onSelect={(v) => setStatus(v)} onClose={() => setShowStatus(false)} />
      <PickerSheet visible={showDept} title="Select Department" options={['', ...departments]} value={department} onSelect={(v) => setDepartment(v)} onClose={() => setShowDept(false)} />
      <PickerSheet visible={showSla} title="Select SLA Status" options={['', ...SLA_FILTERS]} value={slaFilter} onSelect={(v) => setSlaFilter(v)} onClose={() => setShowSla(false)} />
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: any) {
  const { colors, typography, spacing } = useTheme();
  return (
    <AppCard elevation="sm" padding="md" style={styles.statChip}>
      <Text style={[typography.headline.small, { color, fontWeight: '800' }]}>{value}</Text>
      <Text style={[typography.label.small, { color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '700' }]}>{label.toUpperCase()}</Text>
    </AppCard>
  );
}

function PerfCard({ label, value, color }: any) {
  const { colors, typography, spacing } = useTheme();
  return (
    <AppCard style={styles.perfCard} padding="md" elevation="sm">
      <Text style={[typography.headline.small, { color, fontWeight: '800' }]}>{value}</Text>
      <Text style={[typography.label.small, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>{label.toUpperCase()}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  statsRow: { gap: 12, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center' },
  statChip: { minWidth: 120, flexShrink: 0 },
  searchRow: { marginHorizontal: 24, marginTop: 4, marginBottom: 20, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipsRow: { gap: 10, paddingHorizontal: 24, alignItems: 'center', height: 60, paddingVertical: 4 },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  chipClear: { height: 44, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, borderStyle: 'dashed' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slaDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  perfSection: { paddingHorizontal: 24, paddingVertical: 24, borderTopWidth: 1, marginTop: 20 },
  perfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  perfCard: { flex: 1, minWidth: '45%', alignItems: 'center' },
});
