import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTheme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { listNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, type AppNotification } from '@/src/api';
import { showToast } from '@/src/components/Toast';

dayjs.extend(relativeTime);

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listNotifications(user.uid);
      setItems(data.filter(i => !i.archived));
    } catch (e: any) {
      showToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const markRead = async (item: AppNotification) => {
    if (item.read) {
       if (item.complaintId) router.push(`/complaint/${item.complaintId}`);
       return;
    }
    try {
      await markNotificationRead(item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true } : i));
      if (item.complaintId) router.push(`/complaint/${item.complaintId}`);
    } catch (e) {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.uid);
      setItems(prev => prev.map(i => ({ ...i, read: true })));
      showToast('All marked as read', 'success');
    } catch (e) {
      showToast('Failed', 'error');
    }
  };

  const deleteNotif = async (id: string) => {
    try {
      await deleteNotification(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      showToast('Failed to delete', 'error');
    }
  };

  const clearAll = () => {
    const performClear = async () => {
      for (const item of items) {
        await deleteNotification(item.id);
      }
      setItems([]);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to clear all notifications?')) {
        performClear();
      }
      return;
    }

    Alert.alert('Clear All', 'Are you sure you want to clear all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: performClear
      }
    ]);
  };

  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
             <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{unreadCount} UNREAD</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={markAllRead} style={[styles.iconBtn, { borderColor: colors.border }]}>
            <Ionicons name="checkmark-done" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAll} style={[styles.iconBtn, { borderColor: colors.border }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={64} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>All caught up!</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>No new notifications found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => markRead(item)}
              style={[styles.card, { backgroundColor: item.read ? colors.surface : colors.surfaceTint, borderColor: colors.border }]}
            >
              <View style={[styles.typeIcon, { backgroundColor: getNotifColor(item.type) + '15' }]}>
                <Ionicons name={getNotifIcon(item.type) as any} size={22} color={getNotifColor(item.type)} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text, fontWeight: item.read ? '600' : '800' }]}>{item.title}</Text>
                  <Text style={styles.time}>{dayjs(item.createdAt).fromNow()}</Text>
                </View>
                <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>

                {item.complaintId && (
                  <View style={[styles.linkPill, { backgroundColor: colors.background }]}>
                    <Ionicons name="link" size={10} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>{item.complaintId}</Text>
                  </View>
                )}
              </View>

              {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}

              <TouchableOpacity onPress={() => deleteNotif(item.id)} style={styles.deleteBtn}>
                <Ionicons name="close" size={16} color={colors.border} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

function getNotifIcon(type: string) {
  switch (type) {
    case 'ASSIGNMENT': return 'person-add';
    case 'UPDATE': return 'sync';
    case 'ACCOUNT': return 'person-circle';
    default: return 'notifications';
  }
}

function getNotifColor(type: string) {
  switch (type) {
    case 'ASSIGNMENT': return '#7C3AED';
    case 'UPDATE': return '#3B82F6';
    case 'ACCOUNT': return '#10B981';
    default: return '#64748B';
  }
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 100 },
  card: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 14, alignItems: 'flex-start' },
  typeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, flex: 1 },
  time: { fontSize: 11, color: '#94A3B8' },
  message: { fontSize: 13, lineHeight: 18 },
  linkPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, marginTop: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', right: 12, top: 12 },
  deleteBtn: { position: 'absolute', right: 8, bottom: 8, padding: 4 },
});
