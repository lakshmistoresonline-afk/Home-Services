import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/auth';
import { useTheme } from '@/src/theme';
import { listComplaints, getWardAdminContact, type Complaint, type User } from '@/src/api';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from '@/src/config/firebase';
import { AppCard } from '@/src/components/AppCard';
import { AppButton } from '@/src/components/AppButton';

export default function HomeScreen() {
  const { user, logout, isLoggingOut } = useAuth();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    assigned: 0,
    accepted: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wardAdmin, setWardAdmin] = useState<User | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const load = useCallback(async () => {
    if (!user || isLoggingOut) return;
    try {
      const list = await listComplaints();
      if (!auth.currentUser || isLoggingOut) return;
      const s = {
        total: list.length,
        submitted: 0,
        assigned: 0,
        accepted: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        rejected: 0,
        cancelled: 0,
      };
      list.forEach((c: Complaint) => {
        if (c.status === 'Submitted') s.submitted++;
        else if (c.status === 'Assigned') s.assigned++;
        else if (c.status === 'Accepted') s.accepted++;
        else if (c.status === 'In Progress') s.in_progress++;
        else if (c.status === 'Resolved') s.resolved++;
        else if (c.status === 'Closed') s.closed++;
        else if (c.status === 'Rejected') s.rejected++;
        else if (c.status === 'Cancelled') s.cancelled++;
      });
      setStats(s);

      if (user.wardNumber) {
        setLoadingAdmin(true);
        try {
          const admin = await getWardAdminContact(user.wardNumber);
          setWardAdmin(admin);
        } catch (adminError: any) {
          console.error("Ward Admin lookup failed:", adminError.message);
        } finally {
          setLoadingAdmin(false);
        }
      }
    } catch (e: any) {
      console.error("Dashboard load failed:", e.message);
    }
  }, [user, isLoggingOut]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (user && !user.mobile && !isLoggingOut) {
      if (Platform.OS === 'web') {
        router.replace('/(tabs)/profile');
        return;
      }
      Alert.alert(
        'Complete Profile',
        'A mandatory mobile number is required to continue using the application. Please update your profile.',
        [{ text: 'Go to Profile', onPress: () => router.replace('/(tabs)/profile') }],
        { cancelable: false }
      );
    }
  }, [user, isLoggingOut]);

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
          console.error('Home notifications listener error:', error);
        }
      );
      return () => unsubscribe();
    }
  }, [user, isLoggingOut]);

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label.small, { color: colors.primary, letterSpacing: 2, fontWeight: '700' }]}>GRIEVANCE REDRESSAL</Text>
          <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
            Hello, {user?.fullName?.split(' ')[0] || 'Citizen'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={doLogout} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginLeft: spacing.sm }]}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Main Action Card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/complaint/new')}
        >
          <AppCard elevation="md" style={styles.heroCard} padding="lg">
            <View style={{ flex: 1 }}>
              <Text style={[typography.label.medium, { color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }]}>QUICK ACTION</Text>
              <Text style={[typography.headline.small, { color: '#FFFFFF', fontWeight: '800', marginTop: spacing.xs }]}>File a New Complaint</Text>
              <Text style={[typography.body.medium, { color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm }]}>Report civic issues to your local departments instantly.</Text>
            </View>
            <View style={styles.heroIconContainer}>
              <Ionicons name="add-circle" size={48} color="#FFFFFF" />
            </View>
          </AppCard>
        </TouchableOpacity>

        {/* Statistics Hub */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700' }]}>Complaint Statistics</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/complaints')}>
              <Text style={[typography.label.large, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <StatItem label="Total" value={stats.total} color={colors.primary} onPress={() => router.push('/(tabs)/complaints')} />
            <StatItem label="Pending" value={stats.submitted + stats.assigned + stats.accepted + stats.in_progress} color={colors.warning} onPress={() => router.push('/(tabs)/complaints')} />
            <StatItem label="Resolved" value={stats.resolved} color={colors.success} onPress={() => router.push('/(tabs)/complaints')} />
            <StatItem label="Rejected" value={stats.rejected + stats.cancelled} color={colors.danger} onPress={() => router.push('/(tabs)/complaints')} />
          </View>
        </View>

        {/* Detailed Status Breakdown */}
        <AppCard style={{ marginTop: spacing.lg }} padding="md" elevation="sm">
          <Text style={[typography.label.large, { color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' }]}>STATUS BREAKDOWN</Text>
          <View style={styles.breakdownGrid}>
            <StatusChip label="Submitted" value={stats.submitted} color="#F59E0B" />
            <StatusChip label="Assigned" value={stats.assigned} color="#7C3AED" />
            <StatusChip label="Accepted" value={stats.accepted} color="#3B82F6" />
            <StatusChip label="In Progress" value={stats.in_progress} color="#3B82F6" />
            <StatusChip label="Resolved" value={stats.resolved} color="#10B981" />
            <StatusChip label="Closed" value={stats.closed} color="#64748B" />
          </View>
        </AppCard>

        {/* Ward Admin Contact */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700', marginBottom: spacing.md }]}>Your Ward Official</Text>
          {loadingAdmin ? (
            <AppCard style={styles.contactPlaceholder}>
              <Text style={[typography.body.medium, { color: colors.textSecondary, fontStyle: 'italic' }]}>Loading contact information...</Text>
            </AppCard>
          ) : wardAdmin ? (
            <AppCard elevation="sm" padding="md">
              <View style={styles.contactInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                   <Text style={[typography.title.medium, { color: '#FFFFFF', fontWeight: '800' }]}>{wardAdmin.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700' }]}>{wardAdmin.fullName}</Text>
                  <Text style={[typography.body.small, { color: colors.textSecondary }]}>Ward Administrator • {wardAdmin.wardName}</Text>
                </View>
              </View>

              <View style={styles.contactActions}>
                <AppButton
                  title="Call Now"
                  variant="outline"
                  onPress={() => Linking.openURL(`tel:${wardAdmin.mobile}`)}
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                {wardAdmin.email && (
                  <AppButton
                    title="Email"
                    variant="secondary"
                    onPress={() => Linking.openURL(`mailto:${wardAdmin.email}`)}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </AppCard>
          ) : (
            <View style={styles.emptyContact}>
               <Ionicons name="information-circle-outline" size={32} color={colors.textSecondary} />
               <Text style={[typography.body.medium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
                 No contact information is currently available for your ward.
               </Text>
            </View>
          )}
        </View>

        <Text style={[typography.label.small, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl, fontStyle: 'italic' }]}>
          Together we make our neighbourhoods better.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, color, onPress }: { label: string; value: number; color: string; onPress: () => void }) {
  const { colors, typography, spacing, shadows } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.statItem, { backgroundColor: colors.surface, ...shadows.sm }]}>
      <Text style={[typography.headline.small, { color, fontWeight: '800' }]}>{value}</Text>
      <Text style={[typography.label.small, { color: colors.textSecondary, marginTop: spacing.xs }]}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

function StatusChip({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={styles.statusChip}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[typography.body.small, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>{label}</Text>
      <Text style={[typography.title.small, { color: colors.text, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  heroCard: {
    backgroundColor: '#1E3A8A', // Overriding with primary from light theme for better contrast
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 160,
  },
  heroIconContainer: { marginLeft: 16, opacity: 0.3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  contactInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  contactActions: { flexDirection: 'row' },
  contactPlaceholder: { padding: 20, alignItems: 'center' },
  emptyContact: { paddingVertical: 24, alignItems: 'center' },
});

