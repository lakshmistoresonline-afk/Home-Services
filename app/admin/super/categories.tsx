import React, { useCallback, useState } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { listCategories, listDepartments, deleteCategory as deleteCategoryApi, type ComplaintCategory, type Department } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';

export default function CategoryManagement() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ComplaintCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ComplaintCategory | null>(null);

  const [name, setName] = useState('');
  const [dept, setDept] = useState<Department | null>(null);
  const [order, setOrder] = useState('0');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('megaphone');
  const [reqLocation, setReqLocation] = useState(true);
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isActive, setIsActive] = useState(true);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [catList, deptList] = await Promise.all([
        listCategories(),
        listDepartments(),
      ]);
      setItems(catList);
      setDepartments(deptList);
    } catch (e: any) {
      showToast(e.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAddPress = () => {
    setEditItem(null);
    setName('');
    setDept(null);
    setOrder((items.length * 10).toString());
    setReqLocation(true);
    setPriority('Medium');
    setIsActive(true);
    setShowModal(true);
  };

  const onEditPress = (item: ComplaintCategory) => {
    setEditItem(item);
    setName(item.name);
    setDept(departments.find(d => d.id === item.departmentId) || null);
    setOrder(item.displayOrder.toString());
    setColor(item.color || '#3B82F6');
    setIcon(item.icon || 'megaphone');
    setReqLocation(item.requiresLocation);
    setPriority(item.priority || 'Medium');
    setIsActive(item.isActive);
    setShowModal(true);
  };

  const onSave = async () => {
    if (!name.trim()) return showToast('Name is required', 'error');
    if (!dept) return showToast('Department is required', 'error');

    setBusy(true);
    try {
      const data: any = {
        name: name.trim(),
        departmentId: dept.id,
        departmentName: dept.name,
        displayOrder: parseInt(order) || 0,
        color,
        icon,
        requiresLocation: reqLocation,
        priority,
        isActive,
      };

      if (editItem) {
        await updateCategory(editItem.id, data);
        showToast('Category updated', 'success');
      } else {
        await addCategory(data);
        showToast('Category added', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Error saving', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!editItem) return;

    const performDelete = async () => {
      setBusy(true);
      try {
        await deleteCategoryApi(editItem.id);
        showToast('Deleted', 'success');
        setShowModal(false);
        load();
      } catch (e: any) {
        showToast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${editItem.name}? This will affect future complaint filings.`)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Category',
      `Delete ${editItem.name}? This will affect future complaint filings.`,
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

  const goHome = () => {
    router.replace('/admin/super');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Categories</Text>
        <TouchableOpacity onPress={goHome} style={{ marginRight: 12 }}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
        {canModify() && (
          <TouchableOpacity onPress={onAddPress} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => canModify() && onEditPress(item)}
              activeOpacity={canModify() ? 0.7 : 1}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.isActive ? 1 : 0.6 }]}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any || 'megaphone'} size={24} color={item.color || colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.departmentName} · Priority: {item.priority}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                   {item.requiresLocation && <Ionicons name="location" size={14} color={colors.textSecondary} />}
                </View>
                {canModify() && <Ionicons name="chevron-forward" size={18} color={colors.border} style={{ marginTop: 4 }} />}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <Modal transparent visible={showModal} animationType="fade" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setShowModal(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editItem ? 'Edit Category' : 'Add Category'}</Text>

                <Text style={styles.label}>CATEGORY NAME</Text>
                <TextInput value={name} onChangeText={setName} style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="e.g. Street Light" placeholderTextColor={colors.textSecondary} />

                <Text style={styles.label}>MAPPED DEPARTMENT</Text>
                <TouchableOpacity onPress={() => setShowDeptPicker(true)} style={[styles.selector, { borderColor: colors.border }]}>
                   <Text style={{ color: dept ? colors.text : colors.textSecondary }}>{dept ? dept.name : 'Select Dept'}</Text>
                   <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                   <View style={{ flex: 1 }}>
                      <Text style={styles.label}>PRIORITY</Text>
                      <TouchableOpacity onPress={() => setShowPriorityPicker(true)} style={[styles.selector, { borderColor: colors.border }]}>
                         <Text style={{ color: colors.text }}>{priority}</Text>
                         <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                   </View>
                   <View style={{ flex: 1 }}>
                      <Text style={styles.label}>COLOR (HEX)</Text>
                      <TextInput value={color} onChangeText={setColor} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                   </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ORDER</Text>
                    <TextInput value={order} onChangeText={setOrder} keyboardType="numeric" style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ICON NAME</Text>
                    <TextInput value={icon} onChangeText={setIcon} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                  </View>
                </View>

                <View style={styles.checkGrid}>
                   <CheckItem label="Requires Location" active={reqLocation} onPress={() => setReqLocation(!reqLocation)} color={colors.primary} />
                   <CheckItem label="Active" active={isActive} onPress={() => setIsActive(!isActive)} color={colors.primary} />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                  {editItem && (
                    <TouchableOpacity onPress={onDelete} style={[styles.modalBtn, { borderColor: colors.danger, borderWidth: 1 }]}><Ionicons name="trash" size={20} color={colors.danger} /></TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={onSave} disabled={busy} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <PickerSheet
        visible={showDeptPicker}
        title="Map Department"
        options={departments.map(d => d.name)}
        onSelect={(name) => {
           const d = departments.find(x => x.name === name);
           setDept(d || null);
           setShowDeptPicker(false);
        }}
        onClose={() => setShowDeptPicker(false)}
      />

      <PickerSheet
        visible={showPriorityPicker}
        title="Set Default Priority"
        options={['Low', 'Medium', 'High']}
        onSelect={(p: any) => {
           setPriority(p);
           setShowPriorityPicker(false);
        }}
        onClose={() => setShowPriorityPicker(false)}
      />
    </SafeAreaView>
  );
}

function CheckItem({ label, active, onPress, color }: any) {
   return (
      <TouchableOpacity onPress={onPress} style={styles.checkItem}>
         <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? color : '#94A3B8'} />
         <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#1E293B' : '#64748B' }}>{label}</Text>
      </TouchableOpacity>
   );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748B', marginBottom: 6, marginTop: 12, letterSpacing: 1 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  selector: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkGrid: { marginTop: 16, gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBtn: { flex: 1, height: 50, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }
});
