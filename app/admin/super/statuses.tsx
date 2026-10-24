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
import { listStatuses, updateStatusRecord, addStatusRecord, deleteStatusRecord as deleteStatusRecordApi, type ComplaintStatusRecord } from '@/src/api';
import { showToast } from '@/src/components/Toast';

export default function StatusManagement() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ComplaintStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ComplaintStatusRecord | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748B');
  const [icon, setIcon] = useState('ellipse');
  const [order, setOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listStatuses();
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
    setColor('#64748B');
    setIcon('ellipse');
    setOrder((items.length * 10 + 10).toString());
    setIsActive(true);
    setShowModal(true);
  };

  const onEditPress = (item: ComplaintStatusRecord) => {
    setEditItem(item);
    setName(item.name);
    setColor(item.color || '#64748B');
    setIcon(item.icon || 'ellipse');
    setOrder(item.displayOrder.toString());
    setIsActive(item.isActive);
    setShowModal(true);
  };

  const onSave = async () => {
    if (!name.trim()) return showToast('Status name is required', 'error');

    setBusy(true);
    try {
      const data: any = {
        name: name.trim(),
        color,
        icon,
        displayOrder: parseInt(order) || 0,
        isActive,
      };

      if (editItem) {
        await updateStatusRecord(editItem.id, data);
        showToast('Workflow updated', 'success');
      } else {
        await addStatusRecord(data);
        showToast('Status added', 'success');
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
        await deleteStatusRecordApi(editItem.id);
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
      if (window.confirm(`Delete ${editItem.name}? This may break the workflow for existing complaints.`)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Status',
      `Delete ${editItem.name}? This may break the workflow for existing complaints.`,
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
        <Text style={[styles.title, { color: colors.text }]}>Workflow Statuses</Text>
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
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => canModify() && onEditPress(item)}
              activeOpacity={canModify() ? 0.7 : 1}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.isActive ? 1 : 0.6 }]}
            >
              <View style={[styles.statusIndicator, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any || 'ellipse'} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Step {index + 1} · Order {item.displayOrder}</Text>
              </View>
              {item.isActive ? (
                 <View style={[styles.pill, { backgroundColor: '#10B98120' }]}><Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>ACTIVE</Text></View>
              ) : (
                 <View style={[styles.pill, { backgroundColor: colors.border }]}><Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>OFF</Text></View>
              )}
              {canModify() && <Ionicons name="chevron-forward" size={18} color={colors.border} style={{ marginLeft: 8 }} />}
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editItem ? 'Edit Status' : 'Add Status'}</Text>

                <Text style={styles.label}>STATUS NAME</Text>
                <TextInput value={name} onChangeText={setName} style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="e.g. In Progress" placeholderTextColor={colors.textSecondary} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                   <View style={{ flex: 1 }}>
                      <Text style={styles.label}>COLOR (HEX)</Text>
                      <TextInput value={color} onChangeText={setColor} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                   </View>
                   <View style={{ flex: 1 }}>
                      <Text style={styles.label}>ICON NAME</Text>
                      <TextInput value={icon} onChangeText={setIcon} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                   </View>
                </View>

                <View style={{ width: '50%' }}>
                  <Text style={styles.label}>DISPLAY ORDER</Text>
                  <TextInput value={order} onChangeText={setOrder} keyboardType="numeric" style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                </View>

                <TouchableOpacity
                  onPress={() => setIsActive(!isActive)}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 }}
                >
                  <Ionicons name={isActive ? 'checkbox' : 'square-outline'} size={24} color={isActive ? colors.primary : colors.textSecondary} />
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Enabled in Workflow</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 32 }}>
                  {editItem && (
                    <TouchableOpacity onPress={onDelete} style={[styles.modalBtn, { borderColor: colors.danger, borderWidth: 1 }]}><Ionicons name="trash" size={20} color={colors.danger} /></TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={onSave} disabled={busy} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Save Step</Text>}
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
  statusIndicator: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748B', marginBottom: 6, marginTop: 12, letterSpacing: 1 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  modalBtn: { flex: 1, height: 50, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }
});
