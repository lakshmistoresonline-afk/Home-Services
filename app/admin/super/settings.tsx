import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { meta, updateMeta, type Meta } from '@/src/api';
import { showToast } from '@/src/components/Toast';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // App Config
  const [appName, setAppName] = useState('ComplaintsFire');
  const [supportEmail, setSupportContact] = useState('support@mcms.gov.in');

  // Workflow Config
  const [autoAssign, setAutoAssign] = useState(true);
  const [globalSla, setGlobalSla] = useState('72');

  const load = useCallback(async () => {
    try {
      const data = await meta();
      // In a real app, these would be in a dedicated 'settings' collection
      // For this implementation, we simulate them or use 'metadata/app'
      setAppName((meta as any).appName || 'ComplaintsFire');
      setSupportContact((meta as any).supportEmail || 'support@mcms.gov.in');
      setAutoAssign((meta as any).autoAssignmentEnabled ?? true);
      setGlobalSla(((meta as any).defaultSlaHours || 72).toString());
    } catch (e: any) {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      await updateMeta({
        appName,
        supportEmail,
        autoAssignmentEnabled: autoAssign,
        defaultSlaHours: parseInt(globalSla) || 72
      } as any);
      showToast('Settings saved permanently', 'success');
    } catch (e: any) {
      showToast('Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => {
    router.replace('/admin/super');
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>System Configuration</Text>
        <TouchableOpacity onPress={goHome}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <Text style={styles.sectionLabel}>APPLICATION IDENTITY</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <SettingInput label="System Name" value={appName} onChange={setAppName} placeholder="Enter app name" color={colors} editable={canModify()} />
           <View style={[styles.divider, { backgroundColor: colors.border }]} />
           <SettingInput label="Support Contact" value={supportEmail} onChange={setSupportContact} placeholder="Email address" color={colors} editable={canModify()} />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>WORKFLOW & ASSIGNMENT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                 <Text style={{ color: colors.text, fontWeight: '700' }}>Automatic Assignment</Text>
                 <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Route new complaints to best staff instantly.</Text>
              </View>
              <Switch value={autoAssign} onValueChange={setAutoAssign} trackColor={{ true: colors.primary }} disabled={!canModify()} />
           </View>
           <View style={[styles.divider, { backgroundColor: colors.border }]} />
           <SettingInput label="Default SLA (Hours)" value={globalSla} onChange={setGlobalSla} keyboardType="numeric" color={colors} editable={canModify()} />
        </View>

        {canModify() && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 32 }]}>SECURITY & MAINTENANCE</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <TouchableOpacity style={styles.actionRow} onPress={() => {
                 const msg = 'This will disable the app for all citizens. Proceed?';
                 if (Platform.OS === 'web') {
                   if (window.confirm(msg)) {
                     // perform action
                   }
                   return;
                 }
                 Alert.alert('Maintenance Mode', msg, [{text: 'Cancel'}, {text: 'Activate', style: 'destructive'}]);
               }}>
                  <Ionicons name="construct" size={20} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontWeight: '700', marginLeft: 12 }}>Enable Maintenance Mode</Text>
               </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={saveSettings} disabled={busy} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
               {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save All Changes</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingInput({ label, value, onChange, placeholder, color, ...props }: any) {
   return (
      <View style={{ paddingVertical: 12 }}>
         <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 4 }}>{label.toUpperCase()}</Text>
         <TextInput
           value={value}
           onChangeText={onChange}
           placeholder={placeholder}
           placeholderTextColor={color.textSecondary}
           style={{ fontSize: 15, fontWeight: '600', color: color.text, padding: 0 }}
           {...props}
         />
      </View>
   );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1.5, marginBottom: 12 },
  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 20 },
  divider: { height: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  saveBtn: { height: 56, borderRadius: 28, marginTop: 40, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
