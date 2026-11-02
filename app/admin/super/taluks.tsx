import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { listTaluks, listTalukAdmins, sendPasswordReset, type User } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { EmptyState } from '@/src/components/EmptyState';

export default function TalukManagement() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();

  const [taluks, setTaluks] = useState<any[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const [tList, aList] = await Promise.all([
        listTaluks(),
        listTalukAdmins(),
      ]);
      setTaluks(tList || []);
      setAdmins(aList || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const mergedData = useMemo(() => {
    return (taluks || []).map(taluk => {
      const admin = (admins || []).find(a => a.taluk?.toLowerCase() === taluk.name?.toLowerCase());
      return {
        ...taluk,
        admin: admin || null,
      };
    });
  }, [taluks, admins]);

  const filteredData = useMemo(() => {
    let data = mergedData;

    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      data = data.filter(item =>
        (item.name || '').toLowerCase().includes(s) ||
        (item.district || '').toLowerCase().includes(s) ||
        (item.admin?.fullName || '').toLowerCase().includes(s) ||
        (item.admin?.email || '').toLowerCase().includes(s)
      );
    }

    if (statusFilter !== 'all') {
      const active = statusFilter === 'active';
      data = data.filter(item => item.isActive !== !active);
    }

    return data;
  }, [mergedData, debouncedSearch, statusFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const resetPassword = (email: string) => {
    const performReset = async () => {
      try {
        await sendPasswordReset(email);
        showToast('Reset email sent', 'success');
      } catch (e: any) {
        showToast(e.message || 'Failed', 'error');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Send a password reset email to ${email}?`)) {
        performReset();
      }
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send a password reset email to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: performReset }
      ]
    );
  };

  const goHome = () => {
    router.replace('/admin/super');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Taluks & District Operations</Text>
        <TouchableOpacity onPress={goHome} style={{ marginRight: 12 }}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search taluk, district, or admin..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: colors.text }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 56 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            <FilterChip label="Active" active={statusFilter === 'active'} onPress={() => setStatusFilter('active')} />
            <FilterChip label="Inactive" active={statusFilter === 'inactive'} onPress={() => setStatusFilter('inactive')} />
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => item.id || item.name}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No taluks found"
              description="No results match your search or filters."
              onReset={resetFilters}
              icon="map-outline"
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.talukBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="location-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.talukName, { color: colors.text }]}>{item.name} Taluk</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.district || 'Thrissur'} District · Kerala</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#10B98122' }]}>
                  <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>ACTIVE</Text>
                </View>
              </View>

              {item.admin ? (
                <View style={styles.adminInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{item.admin.fullName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.admin.email}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    {canModify() && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: colors.border }]}
                          onPress={() => router.push({ pathname: '/admin/super/add-admin', params: { editUid: item.admin!.uid } })}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Edit Admin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: colors.border }]}
                          onPress={() => resetPassword(item.admin!.email)}
                        >
                          <Ionicons name="key-outline" size={16} color="#F59E0B" />
                          <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 12 }}>Reset Password</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ) : (
                <View>
                  {canModify() ? (
                    <TouchableOpacity
                      style={[styles.placeholderBtn, { backgroundColor: colors.background }]}
                      onPress={() => router.push({ pathname: '/admin/super/add-admin', params: { taluk: item.name } })}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Assign Taluk Admin</Text>
                      <Ionicons name="person-add" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.placeholderBtn, { backgroundColor: colors.background, borderStyle: 'solid' }]}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>No Admin Assigned</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '10' : colors.surface }
      ]}
    >
      <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '800', flex: 1 },
  filterBar: { paddingHorizontal: 24, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, height: '100%', alignItems: 'center', paddingVertical: 4 },
  chip: { paddingHorizontal: 16, height: 36, borderRadius: 100, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  talukBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  talukName: { fontSize: 16, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  adminInfo: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  placeholderBtn: { height: 50, borderRadius: 12, marginTop: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
});
