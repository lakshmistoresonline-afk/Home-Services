import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { listCorporationStaff, listDepartments, listCategories, listWards, checkMobileUnique, updateStaff, createStaff, toggleStaff, type Staff, type Department, type ComplaintCategory } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { EmptyState } from '@/src/components/EmptyState';

type SortOption = 'name' | 'joiningDate' | 'workload' | 'completed';

export default function SuperStaffManagement() {
  const { colors } = useTheme();
  const { user, canModify } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [viewStaff, setViewStaff] = useState<Staff | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedWardNumbers, setSelectedWardNumbers] = useState<number[]>([]);
  const [hasAllWardAccess, setHasAllWardAccess] = useState(true);
  const [designation, setDesignation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [allStaff, depts, cats, wList] = await Promise.all([
        listCorporationStaff(),
        listDepartments(),
        listCategories(),
        listWards(),
      ]);
      setItems(allStaff || []);
      setDepartments(depts || []);
      setCategories(cats || []);
      setWards(wList || []);
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

  const filteredItems = useMemo(() => {
    let data = [...items];

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(i =>
        i.fullName.toLowerCase().includes(q) ||
        i.employeeId?.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.mobile?.includes(q)
      );
    }

    // Filter
    if (deptFilter) {
      data = data.filter(i => i.departments?.includes(deptFilter));
    }
    if (catFilter) {
      data = data.filter(i => i.categories?.includes(catFilter));
    }
    if (desigFilter) {
      data = data.filter(i => i.designation === desigFilter);
    }
    if (statusFilter !== 'all') {
      const active = statusFilter === 'active';
      data = data.filter(i => i.isActive === active);
    }

    // Sort
    data.sort((a, b) => {
      if (sortBy === 'name') return (a.fullName || '').localeCompare(b.fullName || '');
      if (sortBy === 'joiningDate') return dayjs(b.joiningDate).unix() - dayjs(a.joiningDate).unix();
      if (sortBy === 'workload') return (a.activeComplaintCount || 0) - (b.activeComplaintCount || 0);
      if (sortBy === 'completed') return (b.completedComplaintCount || 0) - (a.completedComplaintCount || 0);
      return 0;
    });

    return data;
  }, [items, debouncedSearch, deptFilter, statusFilter, sortBy, catFilter, desigFilter]);

  const onAddPress = () => {
    setEditStaff(null);
    resetForm();
    setShowModal(true);
  };

  const onEditPress = (s: Staff) => {
    setEditStaff(s);
    setName(s.fullName);
    setEmail(s.email);
    setMobile(s.mobile || '');
    setPassword('');
    setSelectedDepts(s.departments || []);
    setSelectedDeptIds(s.departmentIds || []);
    setSelectedCats(s.categories || []);
    setSelectedWardNumbers(s.assignedWardNumbers || []);
    setHasAllWardAccess(s.hasAllWardAccess ?? true);
    setDesignation(s.designation || '');
    setIsActive(s.isActive ?? true);
    setShowModal(true);
  };

  const saveStaff = async () => {
    if (!name.trim()) return showToast('Enter full name', 'error');
    if (!email.trim()) return showToast('Enter email address', 'error');
    if (!mobile || mobile.length !== 10) return showToast('Enter valid 10-digit mobile', 'error');
    if (selectedDepts.length === 0) return showToast('Select department', 'error');
    if (!hasAllWardAccess && selectedWardNumbers.length === 0) return showToast('Select at least one ward or enable All Wards', 'error');
    if (!editStaff && password.length < 6) return showToast('Password min 6 characters', 'error');

    setBusy(true);
    try {
      const isUnique = await checkMobileUnique(mobile, editStaff?.uid);
      if (!isUnique) {
        setBusy(false);
        return showToast('Mobile number already in use', 'error');
      }

      if (editStaff) {
        await updateStaff(editStaff.uid, {
          fullName: name.trim(),
          mobile: mobile.trim(),
          departments: selectedDepts,
          departmentIds: selectedDeptIds,
          categories: selectedCats,
          hasAllWardAccess,
          assignedWardNumbers: hasAllWardAccess ? [] : selectedWardNumbers,
          wardNumber: hasAllWardAccess ? null : (selectedWardNumbers[0] || null),
          designation: designation.trim(),
          isActive
        });
        showToast('Staff updated', 'success');
      } else {
        await createStaff({
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          password,
          departments: selectedDepts,
          departmentIds: selectedDeptIds,
          categories: selectedCats,
          hasAllWardAccess,
          assignedWardNumbers: hasAllWardAccess ? [] : selectedWardNumbers,
          designation: designation.trim(),
          isActive
        });
        showToast('Staff registered', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Operation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setSelectedDepts([]);
    setSelectedDeptIds([]);
    setSelectedCats([]);
    setSelectedWardNumbers([]);
    setHasAllWardAccess(true);
    setDesignation('');
    setIsActive(true);
  };

  const resetFilters = () => {
    setSearch('');
    setDeptFilter('');
    setCatFilter('');
    setDesigFilter('');
    setStatusFilter('all');
    setSortBy('name');
  };

  const toggleActive = async (s: Staff) => {
    try {
      await toggleStaff(s.uid, !s.isActive);
      showToast(s.isActive ? 'Deactivated' : 'Activated', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    }
  };

  const toggleDept = (deptId: string, deptName: string) => {
    setSelectedDeptIds(prev =>
      prev.includes(deptId) ? prev.filter(d => d !== deptId) : [...prev, deptId]
    );
    setSelectedDepts(prev =>
      prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]
    );
  };

  const toggleCat = (catName: string) => {
    setSelectedCats(prev =>
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  };

  const toggleWard = (wardNum: number) => {
    setSelectedWardNumbers(prev =>
      prev.includes(wardNum) ? prev.filter(w => w !== wardNum) : [...prev, wardNum]
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Staff Management</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{items?.length || 0} Total Corporation Resources</Text>
        </View>
        <TouchableOpacity onPress={goHome} style={{ marginRight: 12 }}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
        {canModify() && (
          <TouchableOpacity
            onPress={onAddPress}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search EMP ID, Name, Email..."
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
            <TouchableOpacity onPress={() => setShowSort(true)} style={[styles.miniAction, { borderColor: colors.border }]}>
              <Ionicons name="swap-vertical" size={16} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Sort</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFilters(true)} style={[styles.miniAction, { borderColor: colors.border, backgroundColor: (deptFilter || catFilter || desigFilter) ? colors.primary + '10' : 'transparent' }]}>
              <Ionicons name="funnel" size={14} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Filter</Text>
            </TouchableOpacity>
            <FilterChip label="Active" active={statusFilter === 'active'} onPress={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')} />
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No staff found"
              description="No results match your search or filters."
              onReset={resetFilters}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: item.isActive ? colors.primary : colors.textSecondary }]}>
                <Text style={styles.avatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{item.fullName}</Text>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>{item.employeeId}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => setViewStaff(item)}><Ionicons name="eye-outline" size={18} color={colors.textSecondary} /></TouchableOpacity>
                    {canModify() && <TouchableOpacity onPress={() => onEditPress(item)}><Ionicons name="create-outline" size={18} color={colors.primary} /></TouchableOpacity>}
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{item.designation || 'Field Staff'}</Text>

                <View style={styles.tagWrap}>
                  {item.departments?.map(d => (
                    <View key={d} style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>{d.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.tagWrap, { marginTop: 4 }]}>
                  <Ionicons name="map-outline" size={10} color={colors.textSecondary} style={{ marginTop: 3 }} />
                  {item.hasAllWardAccess ? (
                    <View style={[styles.tag, { backgroundColor: colors.primary + '10' }]}>
                      <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>ALL WARDS</Text>
                    </View>
                  ) : (
                    (item.assignedWardNumbers || []).map(wnum => (
                      <View key={wnum} style={[styles.tag, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '800' }}>W{wnum}</Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.workloadRow}>
                  <View style={styles.statMini}>
                    <Text style={styles.statLabel}>LOAD</Text>
                    <Text style={[styles.statVal, { color: colors.text }]}>{item.activeComplaintCount || 0}</Text>
                  </View>
                  <View style={styles.statMini}>
                    <Text style={styles.statLabel}>DONE</Text>
                    <Text style={[styles.statVal, { color: colors.text }]}>{item.completedComplaintCount || 0}</Text>
                  </View>
                  <View style={styles.statMini}>
                    <Text style={styles.statLabel}>RATING</Text>
                    <Text style={[styles.statVal, { color: '#F59E0B' }]}>{item.rating?.toFixed(1) || '5.0'}</Text>
                  </View>
                </View>
              </View>
              {canModify() && (
                <TouchableOpacity
                  onPress={() => toggleActive(item)}
                  style={[styles.toggle, { backgroundColor: item.isActive ? '#DC262615' : '#10B98115' }]}
                >
                  <Ionicons name={item.isActive ? 'pause' : 'play'} size={16} color={item.isActive ? '#DC2626' : '#10B981'} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Register/Edit Modal */}
      <Modal transparent visible={showModal} animationType="fade" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setShowModal(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editStaff ? 'Update Resource' : 'New Corporation Resource'}</Text>

                <FormField label="FULL NAME *">
                  <TextInput value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                </FormField>

                <FormField label="EMAIL ADDRESS *">
                  <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!editStaff} placeholder="staff@thrissur.gov.in" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, opacity: editStaff ? 0.6 : 1 }]} />
                </FormField>

                <FormField label="MOBILE NUMBER *">
                  <TextInput value={mobile} onChangeText={(val) => setMobile(val.replace(/[^0-9]/g, '').slice(0, 10))} keyboardType="number-pad" placeholder="10-digit mobile" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                </FormField>

                <FormField label="DEPARTMENTS (Multiple)">
                  <View style={styles.chipRow}>
                    {departments.map(d => {
                      const selected = selectedDeptIds.includes(d.id);
                      return <TouchableOpacity key={d.id} onPress={() => toggleDept(d.id, d.name)} style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '15' : colors.background }]}><Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{d.name}</Text></TouchableOpacity>
                    })}
                  </View>
                </FormField>

                <FormField label="CATEGORIES (Expertise)">
                  <View style={styles.chipRow}>
                    {categories.map(c => {
                      const selected = selectedCats.includes(c.name);
                      return <TouchableOpacity key={c.id} onPress={() => toggleCat(c.name)} style={[styles.chip, { borderColor: selected ? '#D97706' : colors.border, backgroundColor: selected ? '#F59E0B15' : colors.background }]}><Text style={{ color: selected ? '#D97706' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{c.name}</Text></TouchableOpacity>
                    })}
                  </View>
                </FormField>

                <FormField label="WARD ACCESS">
                  <TouchableOpacity
                    onPress={() => setHasAllWardAccess(!hasAllWardAccess)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}
                  >
                    <Ionicons name={hasAllWardAccess ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                    <Text style={{ color: colors.text, fontWeight: '700' }}>All Wards (Default)</Text>
                  </TouchableOpacity>
                  {!hasAllWardAccess && (
                    <View style={styles.chipRow}>
                      {(wards || []).map(w => {
                        const selected = selectedWardNumbers.includes(w.wardNumber);
                        return (
                          <TouchableOpacity
                            key={w.wardNumber}
                            onPress={() => toggleWard(w.wardNumber)}
                            style={[styles.chip, {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primary + '15' : colors.background
                            }]}
                          >
                            <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                              {w.wardNumber} - {w.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </FormField>

                <FormField label="DESIGNATION">
                  <TextInput value={designation} onChangeText={setDesignation} placeholder="e.g. Junior Engineer" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                </FormField>

                <TouchableOpacity
                  style={styles.switchRow}
                  activeOpacity={0.8}
                  onPress={() => setIsActive(!isActive)}
                >
                  <View style={{flex: 1}}>
                    <Text style={[styles.label, {color: colors.textSecondary, marginBottom: 4}]}>ACCOUNT STATUS</Text>
                    <Text style={{color: colors.text, fontWeight: '700'}}>{isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                  <Ionicons
                    name={isActive ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>

                {!editStaff && (
                  <FormField label="TEMPORARY PASSWORD *">
                    <TextInput value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={colors.textSecondary} secureTextEntry style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                  </FormField>
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                  <TouchableOpacity onPress={() => setShowModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={saveStaff} disabled={busy} style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>{editStaff ? 'Save' : 'Register'}</Text>}</TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Profile Modal */}
      <Modal transparent visible={!!viewStaff} animationType="fade" onRequestClose={() => setViewStaff(null)}>
        <Pressable style={styles.backdrop} onPress={() => setViewStaff(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            {viewStaff && (
              <ScrollView>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={[styles.largeAvatar, { backgroundColor: colors.primary }]}><Text style={styles.largeAvatarText}>{viewStaff.fullName?.charAt(0).toUpperCase()}</Text></View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 12 }}>{viewStaff.fullName}</Text>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>{viewStaff.employeeId}</Text>
                  <Text style={{ color: colors.textSecondary }}>{viewStaff.designation || 'Field Staff'}</Text>
                </View>

                <ProfileRow label="Email" value={viewStaff.email} color={colors} />
                <ProfileRow label="Mobile" value={viewStaff.mobile || 'N/A'} color={colors} />
                <ProfileRow label="Joined" value={dayjs(viewStaff.joiningDate).format('DD MMM YYYY')} color={colors} />
                <ProfileRow label="Status" value={viewStaff.isActive ? 'Active' : 'Inactive'} valueColor={viewStaff.isActive ? '#10B981' : '#EF4444'} color={colors} />

                <Text style={styles.profileSection}>EXPERTISE & JURISDICTION</Text>
                <View style={styles.tagWrap}>
                  {viewStaff.departments?.map(d => <View key={d} style={[styles.tag, { backgroundColor: colors.primary + '10' }]}><Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>{d.toUpperCase()}</Text></View>)}
                </View>
                <View style={[styles.tagWrap, { marginTop: 8 }]}>
                  {viewStaff.hasAllWardAccess ? (
                    <View style={[styles.tag, { backgroundColor: colors.primary + '10' }]}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>ALL WARDS</Text>
                    </View>
                  ) : (
                    (viewStaff.assignedWardNumbers || []).map(wnum => (
                      <View key={wnum} style={[styles.tag, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>
                          WARD {wnum}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <Text style={styles.profileSection}>PERFORMANCE</Text>
                <View style={styles.perfGrid}>
                  <PerfBox label="Active" value={viewStaff.activeComplaintCount || 0} color={colors.text} />
                  <PerfBox label="Completed" value={viewStaff.completedComplaintCount || 0} color="#10B981" />
                  <PerfBox label="Rating" value={viewStaff.rating?.toFixed(1) || '5.0'} color="#F59E0B" />
                </View>

                <TouchableOpacity onPress={() => setViewStaff(null)} style={[styles.modalBtn, { backgroundColor: colors.surfaceTint, marginTop: 24, height: 50, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontWeight: '800', color: colors.text }}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <PickerSheet
        visible={showSort}
        title="Sort Staff By"
        options={['Name', 'Joining Date', 'Workload', 'Completed Complaints']}
        onSelect={(val) => {
          if (val === 'Name') setSortBy('name');
          if (val === 'Joining Date') setSortBy('joiningDate');
          if (val === 'Workload') setSortBy('workload');
          if (val === 'Completed Complaints') setSortBy('completed');
          setShowSort(false);
        }}
        onClose={() => setShowSort(false)}
      />

      <Modal transparent visible={showFilters} animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, marginTop: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            <Text style={styles.modalTitle}>Advanced Filters</Text>

            <Text style={styles.label}>DEPARTMENT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 16}}>
               <FilterChip label="Any" active={!deptFilter} onPress={() => setDeptFilter('')} />
               {departments.map(d => <FilterChip key={d.id} label={d.name} active={deptFilter === d.name} onPress={() => setDeptFilter(d.name)} />)}
            </ScrollView>

            <Text style={styles.label}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 16}}>
               <FilterChip label="Any" active={!catFilter} onPress={() => setCatFilter('')} />
               {categories.map(c => <FilterChip key={c.id} label={c.name} active={catFilter === c.name} onPress={() => setCatFilter(c.name)} />)}
            </ScrollView>

            <TouchableOpacity
              onPress={() => { setDeptFilter(''); setCatFilter(''); setDesigFilter(''); setShowFilters(false); }}
              style={{ padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Reset All Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowFilters(false)} style={[styles.modalBtn, { backgroundColor: colors.primary, height: 56, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontWeight: '800', color: '#fff' }}>Apply Filters</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function FormField({ label, children }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function ProfileRow({ label, value, valueColor, color }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: color.border }}>
      <Text style={{ color: color.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: valueColor || color.text, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function PerfBox({ label, value, color }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748B', marginTop: 4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.fChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '10' : colors.surface }]}>
      <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filterBar: { paddingHorizontal: 24, paddingVertical: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: '100%', paddingVertical: 4 },
  miniAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 40, borderRadius: 8, borderWidth: 1 },
  fChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  workloadRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  statMini: { alignItems: 'flex-start' },
  statLabel: { fontSize: 8, fontWeight: '800', color: '#64748B' },
  statVal: { fontSize: 14, fontWeight: '800' },
  toggle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  modalBtn: { flex: 1, height: 50, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  largeAvatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  profileSection: { fontSize: 11, fontWeight: '800', color: '#64748B', marginTop: 24, marginBottom: 8, letterSpacing: 1 },
  perfGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 12 },
});
