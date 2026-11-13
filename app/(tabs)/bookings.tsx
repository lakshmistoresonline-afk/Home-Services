import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { listComplaints, type Complaint } from '@/src/api';
import { StatusBadge } from '@/src/components/StatusBadge';
import { auth } from '@/src/config/firebase';
import { AppCard } from '@/src/components/AppCard';
import { Skeleton } from '@/src/components/Skeleton';
import { AppButton } from '@/src/components/AppButton';

export default function BookingsListScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { user, isLoggingOut } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'active' | 'history'>('active');

  const displayedItems = useMemo(() => {
    return items.filter(item => {
      if (activeViewTab === 'active') {
        return ['Submitted', 'Assigned', 'Accepted', 'In Progress'].includes(item.status);
      } else {
        return ['Resolved', 'Closed', 'Cancelled'].includes(item.status);
      }
    });
  }, [items, activeViewTab]);

  const load = useCallback(async () => {
    if (isLoggingOut) return;
    try {
      const list = await listComplaints();
      if (isLoggingOut) return;
      setItems(list as any);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggingOut]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderSkeleton = () => (
    <View style={{ padding: spacing.lg }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <AppCard key={i} style={{ marginBottom: spacing.md }} padding="md">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={60} height={20} borderRadius={10} />
          </View>
          <Skeleton width="90%" height={24} style={{ marginBottom: spacing.sm }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={100} height={14} />
          </View>
        </AppCard>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label.small, { color: colors.primary, letterSpacing: 1.5, fontWeight: '700' }]}>HISTORY</Text>
          <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800' }]}>My Service Requests</Text>
        </View>
        <TouchableOpacity
          testID="new-booking-fab"
          onPress={() => router.push('/service/new')}
          style={[styles.iconBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(i) => i.complaint_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', marginBottom: spacing.md, gap: 10 }}>
              <TouchableOpacity
                onPress={() => setActiveViewTab('active')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: activeViewTab === 'active' ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: activeViewTab === 'active' ? colors.primary : colors.border,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Ionicons name="flash-outline" size={16} color={activeViewTab === 'active' ? '#fff' : colors.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: activeViewTab === 'active' ? '#fff' : colors.textSecondary }}>
                  Active ({items.filter(i => ['Submitted', 'Assigned', 'Accepted', 'In Progress'].includes(i.status)).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveViewTab('history')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: activeViewTab === 'history' ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: activeViewTab === 'history' ? colors.primary : colors.border,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Ionicons name="time-outline" size={16} color={activeViewTab === 'history' ? '#fff' : colors.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: activeViewTab === 'history' ? '#fff' : colors.textSecondary }}>
                  History ({items.filter(i => ['Resolved', 'Closed', 'Cancelled'].includes(i.status)).length})
                </Text>
              </TouchableOpacity>
            </View>
          }
          keyExtractor={(i) => i.complaint_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
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
          ListEmptyComponent={
            <View style={styles.empty} testID="bookings-empty">
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceTint }]}>
                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              </View>
              <Text style={[typography.headline.small, { color: colors.text, fontWeight: '800', marginTop: spacing.lg }]}>No service requests yet</Text>
              <Text style={[typography.body.large, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
                You haven't requested any home services yet. Tap the button below to book a service.
              </Text>
              <AppButton
                title="Raise Service Request"
                onPress={() => router.push('/service/new')}
                style={{ width: '100%' }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`booking-card-${item.complaint_id}`}
              activeOpacity={0.8}
              onPress={() => router.push(`/service/${item.complaint_id}`)}
            >
              <AppCard padding="md" style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={[typography.label.small, { color: colors.textSecondary, letterSpacing: 1 }]}>#{item.complaint_id.toUpperCase()}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={[typography.title.large, { color: colors.text, fontWeight: '700', marginTop: spacing.sm }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.cardMetaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={14} color={colors.primary} />
                    <Text style={[typography.body.small, { color: colors.textSecondary, fontWeight: '600' }]}>{item.departmentName}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                    <Text style={[typography.body.small, { color: colors.textSecondary, fontWeight: '600' }]}>{item.categoryName}</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.cardFooter}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[typography.label.small, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {dayjs(item.created_at).format('MMM D, YYYY · h:mm A')}
                  </Text>
                </View>
                {['Resolved', 'Closed'].includes(item.status) && (
                  <View style={{ marginTop: 8, backgroundColor: '#10B98115', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#047857', fontSize: 11, fontWeight: '800' }}>🛡️ 90-DAY ACTIVE WARRANTY</Text>
                  </View>
                )}
              </AppCard>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { marginRight: 16, padding: 4 },
  iconBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 4 } }) },
  card: {
    borderRadius: 20,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: 1, marginVertical: 12, opacity: 0.5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
});
