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
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import { listAuditLogs, type AuditEntry } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { EmptyState } from '@/src/components/EmptyState';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';


export default function AuditLogScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);

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
      const data = await listAuditLogs();
      setLogs(data || []);
    } catch (e: any) {
      showToast('Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setActionFilter('');
  };

  const exportLogs = async () => {
    if (filteredLogs.length === 0) return showToast('No data to export', 'error');
    setExporting(true);
    try {
      const headers = ["Timestamp", "Actor", "Role", "Action", "Entity Type", "Entity ID", "Changes"];
      const rows = filteredLogs.map(l => [
        dayjs(l.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        l.actor?.name || 'Unknown',
        l.actor?.role || 'N/A',
        l.action,
        l.entity?.type || 'N/A',
        l.entity?.id || 'N/A',
        l.changes ? `"${JSON.stringify(l.changes).replace(/"/g, '""')}"` : ""
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const filename = `audit_logs_${dayjs().format('YYYYMMDD')}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      } else {
        const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri);
      }
      showToast('Logs exported', 'success');
    } catch (e: any) {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredLogs = useMemo(() => {
    let data = [...logs];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(l =>
        (l.actor?.name || '').toLowerCase().includes(q) ||
        (l.entity?.id || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q)
      );
    }
    if (roleFilter) {
      data = data.filter(l => l.actor?.role === roleFilter);
    }
    if (actionFilter) {
      data = data.filter(l => l.action === actionFilter);
    }
    return data;
  }, [logs, debouncedSearch, roleFilter, actionFilter]);

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map(l => l.action).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const goHome = () => {
    router.replace('/admin/super');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Security Audit Logs</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={goHome} style={{ marginRight: 4 }}>
            <Ionicons name="home" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={exportLogs} disabled={exporting}>
            {exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={22} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={load}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search actor or ID..."
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <FilterChip
              label={roleFilter || 'All Roles'}
              active={!!roleFilter}
              onPress={() => setShowRolePicker(true)}
            />
            {uniqueActions.map(action => (
              <FilterChip
                key={action}
                label={action.replace('_', ' ')}
                active={actionFilter === action}
                onPress={() => setActionFilter(actionFilter === action ? '' : action)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No activity logs found"
              description="No results match your search or filters."
              onReset={resetFilters}
              icon="shield-outline"
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) + '15' }]}>
                  <Text style={{ color: getActionColor(item.action), fontSize: 10, fontWeight: '800' }}>{item.action}</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{dayjs(item.timestamp).format('DD MMM, HH:mm:ss')}</Text>
              </View>

              <View style={styles.actorRow}>
                <Ionicons name="person-circle" size={16} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{item.actor?.name || 'System'}</Text>
                {item.actor?.role && (
                  <View style={[styles.roleTag, { backgroundColor: colors.background }]}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary }}>{item.actor.role.toUpperCase()}</Text></View>
                )}
              </View>

              <View style={styles.entityRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Entity: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.entity?.type || 'N/A'} ({item.entity?.id || 'N/A'})</Text></Text>
              </View>

              {item.changes && (
                <View style={[styles.changeBox, { backgroundColor: colors.background }]}>
                  <Text style={styles.changeLabel}>CHANGES</Text>
                  <Text style={{ fontSize: 12, color: colors.text }}>
                    {item.changes.prev !== null && item.changes.prev !== undefined ? String(item.changes.prev) : 'NEW'} → <Text style={{ fontWeight: '700' }}>{String(item.changes.next || 'N/A')}</Text>
                  </Text>
                </View>
              )}

              {item.context?.device && (
                 <Text style={styles.deviceText}><Ionicons name="phone-portrait-outline" size={10} /> {item.context.device}</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <PickerSheet
        visible={showRolePicker}
        title="Filter by Role"
        options={['', 'super_admin', 'ward_admin', 'staff', 'citizen']}
        onSelect={(val) => {
          setRoleFilter(val);
          setShowRolePicker(false);
        }}
        onClose={() => setShowRolePicker(false)}
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: any) {
  const { colors } = useTheme();
  const goHome = () => {
    router.replace('/admin/super');
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '10' : colors.surface }]}
    >
      <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function getActionColor(action: string) {
  if (!action) return '#64748B';
  if (action.includes('CREATED') || action === 'LOGIN') return '#10B981';
  if (action.includes('UPDATED') || action.includes('ASSIGNED')) return '#3B82F6';
  if (action.includes('TOGGLE') || action === 'LOGOUT') return '#F59E0B';
  return '#64748B';
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  filterBar: { paddingHorizontal: 16, paddingBottom: 12 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: '100%', paddingVertical: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  chip: { paddingHorizontal: 12, height: 36, borderRadius: 100, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  logCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  entityRow: { marginBottom: 8 },
  changeBox: { padding: 10, borderRadius: 10, marginTop: 4 },
  changeLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', marginBottom: 4 },
  deviceText: { fontSize: 10, color: '#94A3B8', marginTop: 12 },
});
