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
import { listDepartments, updateDepartment, addDepartment, deleteDepartment as deleteDepartmentApi, type Department } from '@/src/api';
import { showToast } from '@/src/components/Toast';

export default function DepartmentManagement() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [order, setOrder] = useState('0');
  const [icon, setIcon] = useState('business');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listDepartments();
      setItems(data);
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
    setDesc('');
    setOrder((items.length * 10).toString());
    setIcon('business');
    setIsActive(true);
    setShowModal(true);
  };

  const onEditPress = (item: Department) => {
    setEditItem(item);
    setName(item.name);
    setDesc(item.description || '');
    setOrder(item.displayOrder.toString());
    setIcon(item.icon || 'business');
    setIsActive(item.isActive);
    setShowModal(true);
  };

  const onSave = async () => {
    if (!name.trim()) return showToast('Name is required', 'error');

    setBusy(true);
    try {
      const data: any = {
        name: name.trim(),
        description: desc.trim(),
        displayOrder: parseInt(order) || 0,
        icon,
        isActive,
      };

      if (editItem) {
        await updateDepartment(editItem.id, data);
        showToast('Department updated', 'success');
      } else {
        await addDepartment(data);
        showToast('Department added', 'success');
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
        await deleteDepartmentApi(editItem.id);
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
      if (window.confirm(`Delete ${editItem.name}? This will remove it from category mappings.`)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Department',
      `Delete ${editItem.name}? This will remove it from category mappings.`,
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
        <Text style={[styles.title, { color: colors.text }]}>Departments</Text>
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
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name={item.icon as any || 'business'} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>{item.description || 'No description'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>ORDER {item.displayOrder}</Text>
                {canModify() && <Ionicons name="chevron-forward" size={18} color={colors.border} />}
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editItem ? 'Edit Department' : 'Add Department'}</Text>

                <Text style={styles.label}>DEPARTMENT NAME</Text>
                <TextInput value={name} onChangeText={setName} style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="e.g. Roads" placeholderTextColor={colors.textSecondary} />

                <Text style={styles.label}>DESCRIPTION</Text>
                <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Short overview..." placeholderTextColor={colors.textSecondary} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>DISPLAY ORDER</Text>
                    <TextInput value={order} onChangeText={setOrder} keyboardType="numeric" style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ICON NAME</Text>
                    <TextInput value={icon} onChangeText={setIcon} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsActive(!isActive)}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 }}
                >
                  <Ionicons name={isActive ? 'checkbox' : 'square-outline'} size={24} color={isActive ? colors.primary : colors.textSecondary} />
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Active in System</Text>
                </TouchableOpacity>

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
    </SafeAreaView>
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
  modalBtn: { flex: 1, height: 50, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }
});
