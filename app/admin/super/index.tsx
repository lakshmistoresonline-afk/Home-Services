import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { adminStats, adminList, listCorporationStaff, listAuditLogs, slaUtils, type Complaint } from '@/src/api';
import { AppCard } from '@/src/components/AppCard';
import { showToast } from '@/src/components/Toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function SuperAdminDashboard() {
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const { user, logout, hasPermission } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Placeholder stats for the shell
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCitizens: 0,
    totalWardAdmins: 0,
    totalComplaints: 0,
    openComplaints: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    slaBreachedCount: 0,
    deptDistribution: [] as { name: string, count: number }[],
    statusDistribution: [] as { name: string, count: number }[],
    topStaff: [] as any[],
    recentLogs: [] as any[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load basic admin stats (Complaints)
      const fetchBasicStats = async () => {
        try {
          const s = await adminStats();
          setStats(prev => ({
            ...prev,
            totalComplaints: s.total,
            openComplaints: s.submitted + s.assigned + s.in_progress,
            resolvedComplaints: s.resolved,
            pendingComplaints: s.reassign_pending,
          }));
        } catch (e: any) {
          console.error("fetchBasicStats failed:", e.message);
          showToast(`Dashboard stats: ${e.message}`, 'error');
        }
      };

      const fetchAnalytics = async () => {
        try {
          const res = await adminList({ pageSize: 1000 });
          if (!res?.items) return;
          const allComplaints: Complaint[] = res.items;

          // Dept & Status Distribution
          const depts: Record<string, number> = {};
          const statuses: Record<string, number> = {};

          allComplaints.forEach((c: Complaint) => {
            depts[c.departmentName] = (depts[c.departmentName] || 0) + 1;
            statuses[c.status] = (statuses[c.status] || 0) + 1;
          });

          const deptList = Object.entries(depts).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count).slice(0, 5);

          const statusList = Object.entries(statuses).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          setStats(prev => ({
            ...prev,
            slaBreachedCount: allComplaints.filter((c: Complaint) => slaUtils.isBreached(c)).length,
            deptDistribution: deptList,
            statusDistribution: statusList
          }));
        } catch (e: any) {
          console.error("fetchAnalytics failed:", e.message);
        }
      };

      const fetchPerformance = async () => {
         try {
           const staff = await listCorporationStaff();
           const top = [...staff]
             .sort((a, b) => (b.completedComplaintCount || 0) - (a.completedComplaintCount || 0))
             .slice(0, 3);
           setStats(prev => ({ ...prev, topStaff: top }));
         } catch (e: any) { }
      };

      const fetchRecentActivity = async () => {
         try {
           const logs = await listAuditLogs();
           setStats(prev => ({ ...prev, recentLogs: logs.slice(0, 5) }));
         } catch (e: any) { }
      };

      // 2. Load users to count citizens and ward admins
      const fetchAllUsers = async () => {
        try {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const allUsers = allUsersSnap.docs.map((d: any) => d.data());

          const citizens = allUsers.filter((u: any) => u.role === 'citizen');
          const wardAdmins = allUsers.filter((u: any) => u.role === 'ward_admin');

          setStats(prev => ({
            ...prev,
            totalUsers: allUsers.length,
            totalCitizens: citizens.length,
            totalWardAdmins: wardAdmins.length,
          }));
        } catch (e: any) { }
      };

      await Promise.all([
        fetchBasicStats(),
        fetchAnalytics(),
        fetchPerformance(),
        fetchRecentActivity(),
        fetchAllUsers()
      ]);

    } catch (e: any) {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goHome = () => {
    router.replace('/admin/super');
  };

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const menuItems = [
    { id: 'complaints', title: 'Complaint Management', icon: 'megaphone', color: '#DC2626', perm: 'assign_complaints' },
    { id: 'ward-admins', title: 'Ward Management', icon: 'map', color: '#7C3AED', perm: 'manage_wards' },
    { id: 'staff', title: 'Staff Directory', icon: 'construct', color: '#6366F1', perm: 'manage_staff' },
    { id: 'statuses', title: 'Complaint Workflow', icon: 'git-network', color: '#F59E0B', perm: 'manage_settings' },
    { id: 'categories', title: 'Manage Categories', icon: 'list', color: '#10B981', perm: 'manage_categories' },
    { id: 'departments', title: 'Manage Departments', icon: 'business', color: '#F59E0B', perm: 'manage_departments' },
    { id: 'reports', title: 'View Reports', icon: 'bar-chart', color: '#EC4899', perm: 'view_reports' },
    { id: 'logs', title: 'Security Audit Logs', icon: 'shield-half', color: '#64748B', perm: 'view_audit_logs' },
    { id: 'sla', title: 'SLA Management', icon: 'time', color: '#EA580C', perm: 'manage_settings' },
    { id: 'settings', title: 'System Settings', icon: 'settings', color: '#475569', perm: 'manage_settings' },
  ];

  const visibleMenuItems = menuItems.filter(item => hasPermission(item.perm));

  const isReadOnly = user?.role === 'readonly_super_admin';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label.small, { color: isReadOnly ? colors.danger : colors.primary, letterSpacing: 1.5, fontWeight: '700' }]}>
            SUPER ADMIN CONTROL {isReadOnly ? '(VIEW-ONLY)' : ''}
          </Text>
          <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]}>Hi, {user?.fullName?.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity
          onPress={goHome}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: spacing.sm }]}
        >
          <Ionicons name="home-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={doLogout} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700', marginBottom: spacing.md }]}>Dashboard Summary</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Users" value={stats.totalUsers} icon="people-outline" color={colors.primary} />
          <StatCard label="Complaints" value={stats.totalComplaints} icon="megaphone-outline" color="#7C3AED" />
          <StatCard label="SLA Breaches" value={stats.slaBreachedCount} icon="alert-circle-outline" color={colors.danger} />
          <StatCard label="Resolved" value={stats.resolvedComplaints} icon="checkmark-circle-outline" color={colors.success} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.md }}>
          <StatMini label="Citizens" value={stats.totalCitizens} color={colors.textSecondary} />
          <StatMini label="W.Admins" value={stats.totalWardAdmins} color={colors.textSecondary} />
          <StatMini label="Open" value={stats.openComplaints} color={colors.warning} />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700' }]}>Status Distribution</Text>
        </View>
        <AppCard elevation="sm" padding="lg">
          <View style={styles.statusGrid}>
            {stats.statusDistribution.map(s => (
              <View key={s.name} style={styles.statusItem}>
                <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]}>{s.count}</Text>
                <Text style={[typography.label.small, { color: colors.textSecondary, fontWeight: '700', marginTop: 4 }]}>{s.name.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.xl, fontWeight: '700', marginBottom: spacing.md }]}>Top Performing Staff</Text>
        <View style={styles.staffList}>
          {stats.topStaff.map((s, idx) => (
             <AppCard key={s.uid} padding="md" elevation="sm" style={styles.staffRow}>
                <View style={[styles.rank, { backgroundColor: idx === 0 ? colors.warning : colors.primary + '20' }]}>
                  <Text style={{ color: idx === 0 ? '#fff' : colors.primary, fontWeight: '800', fontSize: 12 }}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={[typography.title.small, { color: colors.text, fontWeight: '700' }]}>{s.fullName}</Text>
                   <Text style={[typography.body.small, { color: colors.textSecondary }]}>{s.completedComplaintCount} Resolved · {s.rating?.toFixed(1)} Rating</Text>
                </View>
                <Ionicons name="ribbon" size={24} color={idx === 0 ? colors.warning : colors.border} />
             </AppCard>
          ))}
        </View>

        <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.xl, fontWeight: '700', marginBottom: spacing.md }]}>Department Performance</Text>
        <AppCard elevation="sm" padding="lg">
          {stats.deptDistribution.map((item, idx) => {
            const max = stats.deptDistribution[0]?.count || 1;
            const percent = (item.count / max) * 100;
            return (
              <View key={item.name} style={styles.chartRow}>
                <Text style={[typography.label.medium, { color: colors.text, width: 90 }]} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.barContainer, { backgroundColor: colors.surfaceTint }]}>
                  <View style={[styles.bar, { width: `${percent}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[typography.label.medium, { color: colors.textSecondary, width: 30, textAlign: 'right' }]}>{item.count}</Text>
              </View>
            );
          })}
          {stats.deptDistribution.length === 0 && (
             <Text style={[typography.body.medium, { color: colors.textSecondary, textAlign: 'center', padding: 20 }]}>No data available</Text>
          )}
        </AppCard>

        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700' }]}>Recent System Activity</Text>
          <TouchableOpacity onPress={() => router.push('/admin/super/logs')}><Text style={[typography.label.large, { color: colors.primary, fontWeight: '700' }]}>VIEW ALL</Text></TouchableOpacity>
        </View>
        <AppCard elevation="sm" padding="md">
           {stats.recentLogs.map((log, i) => (
             <View key={log.id} style={[styles.logItem, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
                <Text style={[typography.title.small, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{log.action.replace(/_/g, ' ')}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                   <Text style={[typography.body.small, { color: colors.textSecondary }]}>{log.actor.name} · {dayjs(log.timestamp).fromNow()}</Text>
                   <Text style={[typography.label.small, { color: colors.primary, fontWeight: '700' }]}>{log.entity.type.toUpperCase()}</Text>
                </View>
             </View>
           ))}
        </AppCard>

        <Text style={[typography.title.medium, { color: colors.text, marginTop: spacing.xl, fontWeight: '700', marginBottom: spacing.md }]}>System Management</Text>
        <View style={styles.menuGrid}>
          {visibleMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => {
                if (item.id === 'complaints') router.push('/admin');
                else if (item.id === 'ward-admins') router.push('/admin/super/wards');
                else if (item.id === 'staff') router.push('/admin/super/staff');
                else if (item.id === 'departments') router.push('/admin/super/departments');
                else if (item.id === 'statuses') router.push('/admin/super/statuses');
                else if (item.id === 'categories') router.push('/admin/super/categories');
                else if (item.id === 'reports') router.push('/admin/super/reports');
                else if (item.id === 'logs') router.push('/admin/super/logs');
                else if (item.id === 'sla') router.push('/admin/super/sla-management');
                else if (item.id === 'settings') router.push('/admin/super/settings');
                else showToast('Module coming soon', 'info');
              }}
            >
              <AppCard padding="md" elevation="sm" style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={[typography.title.small, { color: colors.text, flex: 1, fontWeight: '700' }]}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </AppCard>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: any) {
  const { colors, typography, spacing } = useTheme();
  return (
    <AppCard padding="md" elevation="sm" style={styles.statCard}>
      <View style={styles.statTop}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[typography.headline.small, { color, fontWeight: '800' }]}>{value}</Text>
      </View>
      <Text style={[typography.label.small, { color: colors.textSecondary, marginTop: spacing.sm, fontWeight: '700', letterSpacing: 0.5 }]}>{label.toUpperCase()}</Text>
    </AppCard>
  );
}

function StatMini({ label, value, color }: any) {
  const { colors, typography } = useTheme();
  return (
    <AppCard padding="sm" elevation="none" style={[styles.statMini, { backgroundColor: colors.surfaceTint }]}>
      <Text style={[typography.title.medium, { color, fontWeight: '800' }]}>{value}</Text>
      <Text style={[typography.label.small, { color: colors.textSecondary, fontWeight: '700', fontSize: 9 }]}>{label.toUpperCase()}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 60 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%' },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statMini: { flex: 1, alignItems: 'center', borderRadius: 12 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  statusItem: { width: '28%', alignItems: 'center' },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  barContainer: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  staffList: { gap: 12 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logItem: { },
  menuGrid: { gap: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
