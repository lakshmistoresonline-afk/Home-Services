import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/src/theme';
import { listWards, meta, generateReportData, exportToCSV, type Complaint } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { EmptyState } from '@/src/components/EmptyState';

export default function ReportsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Complaint[]>([]);
  const [generated, setGenerated] = useState(false);

  // Filters
  const [ward, setWard] = useState<number | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const [showWardPicker, setShowWardPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [depts, setDepts] = useState<string[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  React.useEffect(() => {
    meta().then(m => setDepts(m?.departments || []));
    listWards().then(list => setWards(list || []));
  }, []);

  const resetFilters = () => {
    setWard(null);
    setDept(null);
    setStatus(null);
    setTimeRange('7d');
    setData([]);
    setGenerated(false);
  };

  const generateReport = async () => {
    setLoading(true);
    setGenerated(true);
    try {
      let startDate: Date | undefined;
      if (timeRange === '7d') startDate = dayjs().subtract(7, 'days').toDate();
      if (timeRange === '30d') startDate = dayjs().subtract(30, 'days').toDate();

      const res = await generateReportData({
        wardNumber: ward || undefined,
        departmentName: dept || undefined,
        status: status || undefined,
        startDate
      });
      setData(res || []);
      if (res?.length) {
        showToast(`${res.length} records found`, 'info');
      }
    } catch (e: any) {
      showToast('Failed to fetch report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    if (data.length === 0) return showToast('No data to export', 'error');

    try {
      const csv = exportToCSV(data);
      const filename = `report_${dayjs().format('YYYYMMDD_HHmm')}.csv`;

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
      showToast('Report exported', 'success');
    } catch (e: any) {
      showToast('Export failed', 'error');
    }
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
        <Text style={[styles.title, { color: colors.text }]}>Analytics Reports</Text>
        <TouchableOpacity onPress={goHome}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.sectionLabel}>REPORT FILTERS</Text>

        <View style={styles.filterGrid}>
           <FilterBox label="Time Range" value={timeRange === 'all' ? 'All Time' : `Last ${timeRange}`} onPress={() => setShowTimePicker(true)} icon="calendar" color={colors} />
           <FilterBox label="Ward" value={ward ? `Ward ${ward}` : 'All Wards'} onPress={() => setShowWardPicker(true)} icon="map" color={colors} />
           <FilterBox label="Department" value={dept || 'All Departments'} onPress={() => setShowDeptPicker(true)} icon="business" color={colors} />
           <FilterBox label="Status" value={status || 'All Statuses'} onPress={() => setShowStatusPicker(true)} icon="filter" color={colors} />
        </View>

        <TouchableOpacity onPress={generateReport} disabled={loading} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
           {loading ? <ActivityIndicator color="#fff" /> : (
             <>
               <Ionicons name="play" size={18} color="#fff" />
               <Text style={styles.btnText}>Generate Dataset</Text>
             </>
           )}
        </TouchableOpacity>

        {generated && !loading && data.length === 0 && (
          <EmptyState
            title="No records found"
            description="Adjust your filters and try again."
            onReset={resetFilters}
          />
        )}

        {data.length > 0 && (
          <View style={[styles.resultsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <Text style={[styles.resultsTitle, { color: colors.text }]}>Dataset Summary</Text>
             <View style={styles.resRow}>
                <View style={styles.resItem}>
                   <Text style={[styles.resVal, { color: colors.primary }]}>{data.length}</Text>
                   <Text style={styles.resLabel}>TOTAL RECORDS</Text>
                </View>
                <View style={styles.resItem}>
                   <Text style={[styles.resVal, { color: '#10B981' }]}>{data.filter(c => c.status === 'Resolved' || c.status === 'Closed').length}</Text>
                   <Text style={styles.resLabel}>COMPLETED</Text>
                </View>
                <View style={styles.resItem}>
                   <Text style={[styles.resVal, { color: colors.danger }]}>{data.filter(c => c.slaBreached).length}</Text>
                   <Text style={styles.resLabel}>SLA BREACHES</Text>
                </View>
             </View>

             <TouchableOpacity onPress={exportCSV} style={[styles.exportBtn, { borderColor: colors.primary }]}>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800' }}>Export as CSV</Text>
             </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
           Standard CSV reports can be opened in Microsoft Excel or Google Sheets for advanced pivot analysis.
        </Text>
      </ScrollView>

      <PickerSheet visible={showTimePicker} title="Select Period" options={['7d', '30d', 'all']} value={timeRange} onSelect={(v: any) => { setTimeRange(v); setShowTimePicker(false); }} onClose={() => setShowTimePicker(false)} />
      <PickerSheet visible={showWardPicker} title="Select Ward" options={['', ...(wards || []).map(w => w.wardNumber.toString())]} value={ward?.toString() || ''} onSelect={(v) => { setWard(v ? parseInt(v) : null); setShowWardPicker(false); }} onClose={() => setShowWardPicker(false)} />
      <PickerSheet visible={showDeptPicker} title="Select Department" options={['', ...(depts || [])]} value={dept || ''} onSelect={(v) => { setDept(v || null); setShowDeptPicker(false); }} onClose={() => setShowDeptPicker(false)} />
      <PickerSheet visible={showStatusPicker} title="Select Status" options={['', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed']} value={status || ''} onSelect={(v) => { setStatus(v || null); setShowStatusPicker(false); }} onClose={() => setShowStatusPicker(false)} />

    </SafeAreaView>
  );
}

function FilterBox({ label, value, onPress, icon, color }: any) {
   return (
      <TouchableOpacity onPress={onPress} style={[styles.filterBox, { backgroundColor: color.surface, borderColor: color.border }]}>
         <Ionicons name={icon} size={16} color={color.primary} />
         <Text style={styles.fbLabel}>{label.toUpperCase()}</Text>
         <Text style={[styles.fbVal, { color: color.text }]} numberOfLines={1}>{value}</Text>
      </TouchableOpacity>
   );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1.5, marginBottom: 16 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filterBox: { width: '48%', borderRadius: 16, borderWidth: 1, padding: 16 },
  fbLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
  fbVal: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  mainBtn: { height: 56, borderRadius: 28, marginTop: 32, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  resultsCard: { marginTop: 32, borderRadius: 24, borderWidth: 1, padding: 24 },
  resultsTitle: { fontSize: 16, fontWeight: '800', marginBottom: 20 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  resItem: { alignItems: 'center' },
  resVal: { fontSize: 24, fontWeight: '800' },
  resLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
  exportBtn: { height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderStyle: 'dashed' },
  footerText: { textAlign: 'center', marginTop: 40, fontSize: 12, lineHeight: 18 },
});
