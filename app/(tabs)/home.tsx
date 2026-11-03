import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/auth';
import { useTheme } from '@/src/theme';
import { listComplaints, listDepartments, type Complaint, type Department } from '@/src/api';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from '@/src/config/firebase';
import { AppCard } from '@/src/components/AppCard';
import { AppButton } from '@/src/components/AppButton';

export default function HomeScreen() {
  const { user, logout, isLoggingOut } = useAuth();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const router = useRouter();

  const [activeRequests, setActiveRequests] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([
    { id: "appliance", name: "Appliance Repair", description: "AC, washing machine, refrigerator repair", displayOrder: 10, icon: "hardware-chip", isActive: true },
    { id: "cleaning", name: "Cleaning & Pest", description: "Full home deep cleaning", displayOrder: 20, icon: "sparkles", isActive: true },
    { id: "water_systems", name: "Well & Tank Care", description: "Well cleaning and chlorination", displayOrder: 25, icon: "water", isActive: true },
    { id: "electrical", name: "Electrician", description: "Electrical wiring and repair", displayOrder: 30, icon: "flash", isActive: true },
    { id: "plumbing", name: "Plumber", description: "Tap leakages and pipe fixing", displayOrder: 40, icon: "water", isActive: true },
    { id: "carpentry", name: "Carpenter", description: "Furniture assembly", displayOrder: 50, icon: "construct", isActive: true },
    { id: "painting", name: "Painting & Civil", description: "Interior and exterior painting", displayOrder: 60, icon: "color-palette", isActive: true },
    { id: "monsoon_care", name: "Monsoon Care", description: "Roof tile waterproofing", displayOrder: 62, icon: "umbrella", isActive: true },
  ]);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!user || isLoggingOut) return;
    try {
      const [listResult, deptResult] = await Promise.allSettled([
        listComplaints(),
        listDepartments()
      ]);
      if (!auth.currentUser || isLoggingOut) return;

      const list = listResult.status === 'fulfilled' ? listResult.value : [];
      const deptList = deptResult.status === 'fulfilled' && deptResult.value.length > 0 ? deptResult.value : departments;
      setDepartments(deptList.filter(d => d.isActive !== false));

      const s = {
        total: list.length,
        submitted: 0,
        assigned: 0,
        in_progress: 0,
        resolved: 0,
      };

      const activeList: Complaint[] = [];

      list.forEach((c: Complaint) => {
        if (c.status === 'Submitted') { s.submitted++; activeList.push(c); }
        else if (c.status === 'Assigned' || c.status === 'Accepted') { s.assigned++; activeList.push(c); }
        else if (c.status === 'In Progress') { s.in_progress++; activeList.push(c); }
        else if (c.status === 'Resolved' || c.status === 'Closed') { s.resolved++; }
      });

      setStats(s);
      setActiveRequests(activeList);
    } catch (e: any) {
      console.warn("Dashboard load notice:", e.message);
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

  const getDeptIcon = (iconName?: string) => {
    switch (iconName) {
      case 'hardware-chip': return 'hardware-chip-outline';
      case 'sparkles': return 'sparkles-outline';
      case 'water': return 'water-outline';
      case 'flash': return 'flash-outline';
      case 'construct': return 'construct-outline';
      case 'color-palette': return 'color-palette-outline';
      case 'umbrella': return 'umbrella-outline';
      case 'business': return 'business-outline';
      case 'sunny': return 'sunny-outline';
      case 'color-fill': return 'color-fill-outline';
      case 'medkit': return 'medkit-outline';
      case 'heart': return 'heart-outline';
      case 'car': return 'car-outline';
      case 'wifi': return 'wifi-outline';
      default: return 'construct-outline';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label.small, { color: colors.primary, letterSpacing: 2, fontWeight: '700' }]}>HOME SERVICES</Text>
          <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
            Hello, {user?.fullName?.split(' ')[0] || 'Customer'}
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
        {/* Main Action Banner */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/service/new')}
        >
          <AppCard elevation="md" style={styles.heroCard} padding="lg">
            <View style={{ flex: 1 }}>
              <Text style={[typography.label.medium, { color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }]}>EXPERT AT YOUR DOORSTEP</Text>
              <Text style={[typography.headline.small, { color: '#FFFFFF', fontWeight: '800', marginTop: spacing.xs }]}>Book a Home Service</Text>
              <Text style={[typography.body.medium, { color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm }]}>Verified electricians, plumbers, cleaners & home experts across Kerala.</Text>
            </View>
            <View style={styles.heroIconContainer}>
              <Ionicons name="add-circle" size={48} color="#FFFFFF" />
            </View>
          </AppCard>
        </TouchableOpacity>

        {/* Dynamic Showcase of All 15+ Service Departments */}
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.title.medium, { color: colors.text, fontWeight: '800', marginBottom: spacing.md }]}>All Home Services ({departments.length})</Text>
          <View style={styles.categoryGrid}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept.id}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/service/new', params: { departmentId: dept.id, departmentName: dept.name } })}
                style={[styles.categoryTile, { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.sm }]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={getDeptIcon(dept.icon) as any} size={24} color={colors.primary} />
                </View>
                <Text style={[typography.label.small, { color: colors.text, fontWeight: '700', textAlign: 'center', marginTop: 8 }]} numberOfLines={2}>
                  {dept.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Active Bookings Banner */}
        {activeRequests.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.title.medium, { color: colors.text, fontWeight: '800' }]}>Active Bookings ({activeRequests.length})</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
                <Text style={[typography.label.large, { color: colors.primary, fontWeight: '700' }]}>View All</Text>
              </TouchableOpacity>
            </View>
            {activeRequests.slice(0, 2).map((req) => (
              <TouchableOpacity
                key={req.complaint_id}
                onPress={() => router.push(`/service/${req.complaint_id}`)}
                activeOpacity={0.85}
                style={{ marginBottom: 12 }}
              >
                <AppCard padding="md" elevation="sm">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[typography.label.small, { color: colors.primary, fontWeight: '800' }]}>#{req.complaint_id.toUpperCase()}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20' }]}>
                      <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>{req.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700', marginTop: 6 }]} numberOfLines={1}>{req.title}</Text>
                  <Text style={[typography.body.small, { color: colors.textSecondary, marginTop: 4 }]}>{req.departmentName} · {req.categoryName}</Text>
                </AppCard>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Customer Support & Help Care */}
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.title.medium, { color: colors.text, fontWeight: '800', marginBottom: spacing.md }]}>Need Help with a Booking?</Text>
          <AppCard elevation="sm" padding="md">
            <View style={styles.supportInfo}>
              <View style={[styles.supportAvatar, { backgroundColor: colors.primary + '15' }]}>
                 <Ionicons name="headset" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.medium, { color: colors.text, fontWeight: '700' }]}>HomeCare Customer Support</Text>
                <Text style={[typography.body.small, { color: colors.textSecondary }]}>Available 24/7 for booking assistance and partner queries.</Text>
              </View>
            </View>

            <View style={styles.supportActions}>
              <AppButton
                title="Call Support"
                variant="outline"
                onPress={() => Linking.openURL('tel:1800123456')}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <AppButton
                title="Email Support"
                variant="secondary"
                onPress={() => Linking.openURL('mailto:support@homeservice.gov.in')}
                style={{ flex: 1 }}
              />
            </View>
          </AppCard>
        </View>

        <Text style={[typography.label.small, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl, fontStyle: 'italic' }]}>
          Professional Home Services across Kerala.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 150,
    borderRadius: 20,
  },
  heroIconContainer: { marginLeft: 16, opacity: 0.3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryTile: {
    width: Platform.OS === 'web' ? '18%' : '30%',
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  supportInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  supportAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  supportActions: { flexDirection: 'row' },
});
