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
import { adminList, adminStats, meta, listCorporationStaff, getPerformanceMetrics, assignmentEngine, type Complaint, type User } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { AppCard } from '@/src/components/AppCard';
import { PickerSheet } from '@/src/components/PickerSheet';
import { Skeleton } from '@/src/components/Skeleton';
import { EmptyState } from '@/src/components/EmptyState';
import { showToast } from '@/src/components/Toast';

dayjs.extend(isToday);

const STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

function getCategoryIconName(dept: string = '', cat: string = ''): keyof typeof Ionicons.glyphMap {
  const text = (dept + ' ' + cat).toLowerCase();
  if (text.includes('elec') || text.includes('wire')) return 'flash-outline';
  if (text.includes('appliance') || text.includes('ac')) return 'hardware-chip-outline';
  if (text.includes('clean') || text.includes('pest')) return 'sparkles-outline';
  if (text.includes('water') || text.includes('well') || text.includes('plumb')) return 'water-outline';
  return 'construct-outline';
}

function getStatusBorderColor(status: string, colors: any): string {
  switch (status) {
    case 'Submitted': return '#F59E0B';
    case 'Assigned': return '#3B82F6';
    case 'In Progress': return '#06B6D4';
    case 'Resolved': return '#10B981';
    case 'Closed': return '#64748B';
    case 'Cancelled': case 'Rejected': return '#DC2626';
    default: return '#047857';
  }
}

const StatPill = React.memo(({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color + '12', borderColor: color + '30', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ fontSize: 13, fontWeight: '800', color: color }}>{value}</Text>
    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>{label}</Text>
  </View>
));

const ComplaintListItem = React.memo(({ item, onPress }: { item: Complaint, onPress: () => void }) => {
  const { colors, typography, spacing } = useTheme();
  const iconName = getCategoryIconName(item.departmentName, item.categoryName);
  const borderColor = getStatusBorderColor(item.status, colors);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <AppCard padding="md" elevation="sm" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ backgroundColor: colors.primary + '15', padding: 6, borderRadius: 8 }}>
              <Ionicons name={iconName} size={16} color={colors.primary} />
            </View>
            <Text style={[typography.label.small, { color: colors.textSecondary, letterSpacing: 1.2, fontWeight: '700' }]}>
              {item.complaint_id || item.request_id}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.sm, fontWeight: '700' }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={[styles.metaRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.md }]}>
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
  const isWardAdmin = user?.role === 'ward_admin' || user?.role === 'taluk_admin';
  const isStaff = user?.role === 'staff';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'active' | 'history'>('active');

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
      case 'taluk_admin':
      case 'ward_admin': return `${(user?.taluk || 'THRISSUR').toUpperCase()} TALUK ADMIN`;
      case 'staff': return 'FIELD SERVICE DASHBOARD';
      default: return 'TALUK ADMIN DASHBOARD';
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
        role: user?.role,
        taluk: user?.taluk,
        lastDoc: isMore ? lastDocRef.current : undefined
      };

      const fetchAdminList = async () => {
        try {
          const res = await adminList(params);
          if (!auth.currentUser || isLoggingOut) return;

          let list: Complaint[] = Array.isArray(res) ? res : (res?.items || []);

          if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            list = list.filter(item =>
              (item.title || '').toLowerCase().includes(q) ||
              (item.description || '').toLowerCase().includes(q) ||
              (item.complaint_id || '').toLowerCase().includes(q) ||
              (item.request_id || '').toLowerCase().includes(q) ||
              (item.citizenName || '').toLowerCase().includes(q) ||
              (item.assignedStaffName || '').toLowerCase().includes(q)
            );
          }

          if (department) {
            list = list.filter(item => item.departmentName === department || item.departmentId === department);
          }

          if (status) {
            list = list.filter(item => item.status === status);
          }

          if (assignedFilter) {
            if (assignedFilter === 'unassigned') {
              list = list.filter(item => !item.assignedStaffId);
            } else if (assignedFilter === 'me') {
              list = list.filter(item => item.assignedStaffId === user.uid);
            } else {
              list = list.filter(item => !!item.assignedStaffId);
            }
          }

          setItems(list);
          hasMoreRef.current = false;
          setHasMore(false);

          // Update stats bar dynamically from filtered items
          setStats(prev => ({
            ...prev,
            total: list.length,
            submitted: list.filter(r => r.status === 'Submitted').length,
            assigned: list.filter(r => r.status === 'Assigned').length,
            in_progress: list.filter(r => r.status === 'In Progress').length,
            resolved: list.filter(r => r.status === 'Resolved' || r.status === 'Completed').length,
            closed: list.filter(r => r.status === 'Closed').length,
            unassigned: list.filter(r => !r.assignedStaffId).length,
          }));

        } catch (e: any) {
          if (!isLoggingOut && auth.currentUser) {
             showToast(`Error: ${e.message}`, 'error');
          }
        }
      };

      const fetchAdminStats = async () => {
        try {
          const s = await adminStats({
            role: user?.role,
            taluk: user?.taluk
          });
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
        } catch (e: any) {
          console.warn("Maintenance sweep notice:", e?.message || e);
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
  }, [debouncedSearch, department, status, assignedFilter, isWardAdmin, isSuper, isStaff, user, isLoggingOut]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('demo=')) {
      setComplaints([
        {
          complaint_id: "SRV-901824",
          request_id: "SRV-901824",
          title: "Clay Roof Tile Leakage Sealant",
          categoryName: "Roof Tile Leak Repair & Waterproofing",
          departmentName: "Monsoon Care",
          subCategoryName: "Clay Tile Leakage Sealant & Replacement",
          citizenName: "Rahul Nair",
          status: "Submitted",
          district: "Thrissur",
          taluk: "Thrissur",
          created_at: new Date().toISOString(),
          basePrice: 1499
        } as any,
        {
          complaint_id: "SRV-849201",
          request_id: "SRV-849201",
          title: "Foam & Jet Pump Deep Chemical Wash",
          categoryName: "AC Service & Repair",
          departmentName: "Appliance Repair",
          subCategoryName: "Foam & Jet Pump Deep Wash",
          citizenName: "Anjali Menon",
          assignedStaffName: "Rajesh AC Expert",
          status: "In Progress",
          district: "Thrissur",
          taluk: "Thrissur",
          created_at: new Date().toISOString(),
          basePrice: 599
        } as any,
        {
          complaint_id: "SRV-391024",
          request_id: "SRV-391024",
          title: "Main MCB Short Circuit Trip Fix",
          categoryName: "Electrical Repair & Wiring",
          departmentName: "Electrician",
          subCategoryName: "Main MCB & Short Circuit Emergency",
          citizenName: "Vipin Kumar",
          assignedStaffName: "Suresh Electrician",
          status: "Assigned",
          district: "Thrissur",
          taluk: "Thrissur",
          created_at: new Date().toISOString(),
          basePrice: 349
        } as any,
        {
          complaint_id: "SRV-102948",
          request_id: "SRV-102948",
          title: "Open Well Sludge Removal & Chlorination",
          categoryName: "Well Cleaning & Chlorination (Desilting)",
          departmentName: "Water Systems & Well Care",
          subCategoryName: "Open Well Sludge Removal & Chlorination",
          citizenName: "Sreekumar K",
          assignedStaffName: "Arun Master Plumber",
          status: "Resolved",
          district: "Thrissur",
          taluk: "Thrissur",
          created_at: new Date().toISOString(),
          basePrice: 1999
        } as any
      ]);
      setComplaintStats({ total: 24, submitted: 5, assigned: 8, in_progress: 4, resolved: 7, unassigned: 5, dueTodayCount: 3, slaBreachedCount: 0, nearSlaCount: 1 });
      setLoading(false);
    }
  }, []);

  // Initial load when screen is focused
  useFocusEffect(
    useCallback(() => {
      load(false);
      // Auto-sync any queued offline mutations on screen focus
      import('@/src/api/offlineQueue').then(m => m.syncOfflineQueue().then(c => {
        if (c > 0) showToast(`Synced ${c} offline update${c > 1 ? 's' : ''}`, 'success');
      })).catch(() => {});
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
  }, [debouncedSearch, department, status, assignedFilter]);

  useEffect(() => {
    if (user && !isLoggingOut) {
      const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", user.uid),
        where("read", "==", false)
      );
      const unsubscribeNotif = onSnapshot(q,
        (snap) => {
          if (!auth.currentUser || isLoggingOut) return;
          setUnreadCount(snap?.size || 0);
        },
        (error) => {
          if (error.code === 'permission-denied') return;
          console.error('Admin notifications listener error:', error);
        }
      );

      // Real-time Service Requests Listener for instant dashboard sync
      let reqQuery;
      if (isWardAdmin) {
        const talukName = user.taluk || 'Thrissur';
        reqQuery = query(collection(db, "serviceRequests"), where("taluk", "==", talukName));
      } else if (isSuper) {
        reqQuery = query(collection(db, "serviceRequests"));
      }

      let unsubscribeReq: (() => void) | undefined;
      if (reqQuery) {
        unsubscribeReq = onSnapshot(reqQuery, (snap) => {
          if (!auth.currentUser || isLoggingOut) return;
          // Refresh list and stats on real-time document mutation
          load(false);
        }, (err) => {
          /* non-blocking snapshot notice */
        });
      }

      return () => {
        unsubscribeNotif();
        if (unsubscribeReq) unsubscribeReq();
      };
    }
  }, [user, isLoggingOut, isWardAdmin, isSuper]);

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
    setAssignedFilter('');
  };

  const activeFilters = useMemo(() => {
    return [
      status && { key: 'status', label: status, clear: () => setStatus('') },
      department && { key: 'dept', label: department, clear: () => setDepartment('') },
      assignedFilter && {
        key: 'assigned',
        label: assignedFilter === 'unassigned' ? 'Unassigned' : assignedFilter === 'me' ? 'Assigned to me' : 'Assigned',
        clear: () => setAssignedFilter(''),
      },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  }, [status, department, assignedFilter]);

  const displayedItems = useMemo(() => {
    return items.filter(item => {
      if (activeViewTab === 'active') {
        return ['Submitted', 'Assigned', 'Accepted', 'In Progress'].includes(item.status);
      } else {
        return ['Resolved', 'Closed', 'Cancelled'].includes(item.status);
      }
    });
  }, [items, activeViewTab]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/super');
    }
  };

  if (!user && !loading) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flex: 1, maxWidth: 1200, width: '100%', alignSelf: 'center' }}>

      {loading && items.length === 0 ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          {[1,2,3,4].map(i => (
            <View key={i} style={{ marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.primary + '40', borderRadius: 16, overflow: 'hidden' }}>
              <Skeleton height={130} borderRadius={16} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(i) => i.complaint_id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={colors.primary} />}
          onEndReached={() => load(true)}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <>
              {/* Header inside ListHeaderComponent */}
              <View style={[styles.header, { paddingVertical: spacing.xs }]}>
                {isSuper && (
                  <TouchableOpacity onPress={handleBack} style={{ marginRight: spacing.sm }}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[typography.label.small, { color: colors.primary, letterSpacing: 1.2, fontWeight: '700', fontSize: 11 }]}>{roleLabel}</Text>
                  <Text style={[typography.title.large, { color: colors.text, fontWeight: '800' }]}>Hi, {user?.fullName?.split(' ')[0] || 'Admin'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => router.push('/notifications')}
                    style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.xs, width: 36, height: 36 }]}
                  >
                    <Ionicons name="notifications-outline" size={18} color={colors.text} />
                    {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
                  </TouchableOpacity>
                  {isSuper && (
                    <TouchableOpacity
                      onPress={goHome}
                      style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.xs, width: 36, height: 36 }]}
                    >
                      <Ionicons name="home-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={doLogout} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, width: 36, height: 36 }]}>
                    <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Compact Inline Pill Stat Chips (36px height) */}
              <View style={{ marginVertical: spacing.xs }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {isStaff ? (
                    <>
                      <StatPill label="Assigned" value={complaintStats.assigned} color={colors.primary} />
                      <StatPill label="In Progress" value={complaintStats.in_progress} color={colors.warning} />
                      <StatPill label="Resolved" value={complaintStats.resolved} color={colors.success} />
                    </>
                  ) : (
                    <>
                      <StatPill label="Total" value={complaintStats.total} color={colors.primary} />
                      <StatPill label="Open" value={complaintStats.submitted + complaintStats.assigned + complaintStats.in_progress} color={colors.warning} />
                      <StatPill label="Resolved" value={complaintStats.resolved} color={colors.success} />
                      <StatPill label="Unassigned" value={complaintStats.unassigned} color={colors.danger} />
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Active Requests vs Completed History Segmented Tab Bar */}
              <View style={{ flexDirection: 'row', marginVertical: spacing.xs, gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setActiveViewTab('active')}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: activeViewTab === 'active' ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: activeViewTab === 'active' ? colors.primary : colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Ionicons name="flash-outline" size={15} color={activeViewTab === 'active' ? '#fff' : colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: activeViewTab === 'active' ? '#fff' : colors.textSecondary }}>
                    Active ({items.filter(i => ['Submitted', 'Assigned', 'Accepted', 'In Progress'].includes(i.status)).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveViewTab('history')}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: activeViewTab === 'history' ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: activeViewTab === 'history' ? colors.primary : colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Ionicons name="time-outline" size={15} color={activeViewTab === 'history' ? '#fff' : colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: activeViewTab === 'history' ? '#fff' : colors.textSecondary }}>
                    History ({items.filter(i => ['Resolved', 'Closed', 'Cancelled'].includes(i.status)).length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Compact Slim 40px Search Row */}
              <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.surface, marginHorizontal: 0, height: 42, marginVertical: spacing.xs, borderRadius: 10, ...shadows.sm }]}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  testID="admin-search-input"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isStaff ? "Search request ID or title" : "Search ID, name or staff..."}
                  placeholderTextColor={colors.textSecondary}
                  style={{ flex: 1, color: colors.text, fontSize: 14, paddingLeft: spacing.xs }}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} testID="admin-search-clear">
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Compact Filter Chips Row */}
              <View style={{ marginBottom: spacing.sm }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  <TouchableOpacity
                    onPress={() => setShowStatus(true)}
                    style={[styles.chip, { borderColor: status ? colors.primary : colors.border, backgroundColor: status ? colors.primary + '10' : colors.surface, paddingVertical: 4, height: 32 }]}
                  >
                    <Ionicons name="filter-outline" size={14} color={status ? colors.primary : colors.textSecondary} />
                    <Text style={[typography.label.small, { color: status ? colors.primary : colors.textSecondary, fontWeight: '700' }]}>{status || 'Status'}</Text>
                  </TouchableOpacity>
                  {!isStaff && (
                    <TouchableOpacity
                      onPress={() => setShowDept(true)}
                      style={[styles.chip, { borderColor: department ? colors.primary : colors.border, backgroundColor: department ? colors.primary + '10' : colors.surface, paddingVertical: 4, height: 32 }]}
                    >
                      <Ionicons name="business-outline" size={14} color={department ? colors.primary : colors.textSecondary} />
                      <Text style={[typography.label.small, { color: department ? colors.primary : colors.textSecondary, fontWeight: '700' }]}>{department || 'Department'}</Text>
                    </TouchableOpacity>
                  )}
                  {activeFilters.map((f) => (
                    <TouchableOpacity key={f.key} onPress={f.clear} style={[styles.chipClear, { borderColor: colors.border, backgroundColor: colors.surfaceTint, height: 32 }]}>
                      <Ionicons name="close" size={14} color={colors.textSecondary} />
                      <Text style={[typography.label.small, { color: colors.textSecondary, fontWeight: '700' }]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </>
          }
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
              title="No service requests match"
              description="Try adjusting your filters or search term."
              onReset={resetFilters}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <ComplaintListItem
              item={item}
              onPress={() => router.push(`/service/${item.complaint_id}`)}
            />
          )}
        />
      )}
      </View>

      <PickerSheet visible={showStatus} title="Select Status" options={['', ...STATUSES]} value={status} onSelect={(v) => setStatus(v)} onClose={() => setShowStatus(false)} />
      <PickerSheet visible={showDept} title="Select Department" options={['', ...departments]} value={department} onSelect={(v) => setDepartment(v)} onClose={() => setShowDept(false)} />
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
