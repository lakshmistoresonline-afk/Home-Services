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
import { listWards, listWardAdmins, upsertWard, toggleWard, deleteWard as deleteWardApi, sendPasswordReset, type User, type Ward } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { EmptyState } from '@/src/components/EmptyState';

export default function WardManagement() {
  const { colors } = useTheme();
  const { canModify, canAssign } = useAuth();
  const router = useRouter();

  const [wards, setWards] = useState<Ward[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showWardModal, setShowWardModal] = useState(false);
  const [editWard, setEditWard] = useState<Ward | null>(null);
  const [wardNum, setWardNum] = useState('');
  const [wardName, setWardName] = useState('');
  const [busy, setBusy] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const [wList, aList] = await Promise.all([
        listWards(),
        listWardAdmins(),
      ]);
      setWards(wList || []);
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
    return (wards || []).map(ward => {
      const admin = (admins || []).find(a => a.wardNumber === ward.wardNumber);
      return {
        ...ward,
        admin: admin || null,
      };
    });
  }, [wards, admins]);

  const filteredData = useMemo(() => {
    let data = mergedData;

    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      data = data.filter(item =>
        item.wardNumber?.toString().includes(s) ||
        (item.name || '').toLowerCase().includes(s) ||
        (item.admin?.fullName || '').toLowerCase().includes(s) ||
        (item.admin?.email || '').toLowerCase().includes(s)
      );
    }

    if (statusFilter !== 'all') {
      const active = statusFilter === 'active';
      data = data.filter(item => item.isActive === active);
    }

    return data;
  }, [mergedData, debouncedSearch, statusFilter]);

  const onAddWard = () => {
    setEditWard(null);
    setWardNum('');
    setWardName('');
    setShowWardModal(true);
  };

  const onEditWard = (ward: Ward) => {
    setEditWard(ward);
    setWardNum(ward.wardNumber?.toString() || '');
    setWardName(ward.name || '');
    setShowWardModal(true);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const saveWard = async () => {
    if (!wardNum || !wardName.trim()) return showToast('All fields required', 'error');
    setBusy(true);
    try {
      await upsertWard({
        wardNumber: parseInt(wardNum),
        name: wardName.trim(),
        isActive: editWard ? editWard.isActive : true
      });
      showToast('Ward saved', 'success');
      setShowWardModal(false);
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleWardStatus = async (item: any) => {
    try {
      await toggleWard(item.wardNumber, !item.isActive);
      showToast('Status updated', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    }
  };

  const deleteWard = (item: any) => {
    const performDelete = async () => {
      try {
        await deleteWardApi(item.wardNumber);
        showToast('Ward deleted', 'success');
        load();
      } catch (e: any) {
        showToast(e.message || 'Failed', 'error');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete Ward ${item.wardNumber} - ${item.name}? This may affect assigned complaints.`)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Ward',
      `Are you sure you want to delete Ward ${item.wardNumber} - ${item.name}? This may affect assigned complaints.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete
        }
      ]
    );
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
        {
          text: 'Send',
          onPress: performReset
        }
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
        <Text style={[styles.title, { color: colors.text }]}>Wards & Admins</Text>
        <TouchableOpacity onPress={goHome} style={{ marginRight: 12 }}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
        {canModify() && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={onAddWard}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search ward or admin..."
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
          keyExtractor={item => item.wardNumber?.toString()}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No wards found"
              description="No results match your search or filters."
              onReset={resetFilters}
              icon="map-outline"
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.isActive ? 1 : 0.6 }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.wardBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{item.wardNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.wardName, { color: colors.text }]}>{item.name}</Text>
                    {canModify() && <TouchableOpacity onPress={() => onEditWard(item)}><Ionicons name="create-outline" size={14} color={colors.textSecondary} /></TouchableOpacity>}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Official Corporation Ward</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {canModify() && (
                    <>
                      <TouchableOpacity onPress={() => deleteWard(item)} style={[styles.statusBadge, { backgroundColor: '#EF444415' }]}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleWardStatus(item)} style={[styles.statusBadge, { backgroundColor: item.isActive ? '#10B98122' : '#EF444422' }]}>
                          <Text style={{ color: item.isActive ? '#10B981' : '#EF4444', fontSize: 10, fontWeight: '800' }}>
                            {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {item.admin ? (
                <View style={styles.adminInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{item.admin.fullName}</Text>
                    {!item.admin.isActive && <View style={styles.suspendedTag}><Text style={styles.suspendedText}>SUSPENDED</Text></View>}
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
                          <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 12 }}>Reset</Text>
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
                      onPress={() => router.push({ pathname: '/admin/super/add-admin', params: { wardNumber: item.wardNumber?.toString() } })}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Assign Ward Admin</Text>
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

      {/* Add/Edit Ward Modal */}
      <Modal transparent visible={showWardModal} animationType="fade" onRequestClose={() => setShowWardModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowWardModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editWard ? 'Edit Ward' : 'Add New Ward'}</Text>

            <Text style={styles.label}>WARD NUMBER</Text>
            <TextInput
              value={wardNum}
              onChangeText={setWardNum}
              keyboardType="numeric"
              editable={!editWard}
              style={[styles.input, { color: colors.text, borderColor: colors.border, opacity: editWard ? 0.6 : 1 }]}
              placeholder="e.g. 1"
            />

            <Text style={styles.label}>WARD NAME</Text>
            <TextInput
              value={wardName}
              onChangeText={setWardName}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Poonkunnam"
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity onPress={() => setShowWardModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveWard} disabled={busy} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Save Ward</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  filterBar: { paddingHorizontal: 24, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, height: '100%', alignItems: 'center', paddingVertical: 4 },
  chip: { paddingHorizontal: 16, height: 36, borderRadius: 100, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wardBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wardName: { fontSize: 16, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  adminInfo: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  suspendedTag: { backgroundColor: '#EF444415', paddingHorizontal: 4, borderRadius: 4 },
  suspendedText: { color: '#EF4444', fontSize: 8, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  placeholderBtn: { height: 50, borderRadius: 12, marginTop: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 24, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748B', marginBottom: 6, marginTop: 12, letterSpacing: 1 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  modalBtn: { flex: 1, height: 50, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }
});
