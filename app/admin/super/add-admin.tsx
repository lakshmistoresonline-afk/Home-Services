import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { listTalukAdmins, checkMobileUnique, updateTalukAdmin, createTalukAdmin, type User } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';

const KERALA_TALUKS = [
  'Thrissur',
  'Chavakkad',
  'Kodungallur',
  'Mukundapuram',
  'Chalakudy',
  'Talappilly',
  'Kunnamkulam'
];

export default function AddEditTalukAdmin() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();
  const { taluk: initialTaluk, editUid } = useLocalSearchParams<{ taluk?: string, editUid?: string }>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState<string>(initialTaluk || 'Thrissur');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [showTalukPicker, setShowTalukPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        if (editUid) {
           const admins = await listTalukAdmins();
           const admin = admins.find(a => a.uid === editUid);
           if (admin) {
              setName(admin.fullName);
              setEmail(admin.email);
              setMobile(admin.mobile);
              setSelectedTaluk(admin.taluk || 'Thrissur');
              setIsActive(admin.isActive);
           }
        }
      } catch (e: any) {
        showToast('Error loading data', 'error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [editUid]);

  const goHome = () => {
    router.replace('/admin/super');
  };

  const onSubmit = async () => {
    if (!name.trim()) return showToast('Enter name', 'error');
    if (!email.trim()) return showToast('Enter email', 'error');
    if (!mobile || mobile.length !== 10) return showToast('Enter valid 10-digit mobile', 'error');
    if (!selectedTaluk) return showToast('Select Taluk', 'error');
    if (!editUid && password.length < 6) return showToast('Password min 6 chars', 'error');

    setBusy(true);
    try {
      const isUnique = await checkMobileUnique(mobile, editUid || undefined);
      if (!isUnique) {
        setBusy(false);
        return showToast('Mobile number already in use', 'error');
      }

      if (editUid) {
        await updateTalukAdmin(editUid, {
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          taluk: selectedTaluk,
          isActive
        });
        showToast('Admin updated successfully', 'success');
      } else {
        await createTalukAdmin({
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          district: 'Thrissur',
          taluk: selectedTaluk,
          password
        });
        showToast('Taluk Admin created successfully', 'success');
      }
      router.back();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.primary}/></View>;
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/super');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {editUid ? 'Edit Taluk Admin' : 'Add Taluk Admin'}
        </Text>
        <TouchableOpacity onPress={goHome}>
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
         <AppInput
            label="FULL NAME *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Anand Varma"
            editable={canModify()}
         />
         <AppInput
            label="EMAIL ADDRESS *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="admin@homeservice.in"
            editable={canModify() && !editUid}
         />
         <AppInput
            label="MOBILE NUMBER *"
            value={mobile}
            onChangeText={(val) => setMobile(val.replace(/[^0-9]/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="10-digit mobile"
            editable={canModify()}
         />

         <Text style={styles.inputLabel}>TALUK JURISDICTION *</Text>
         <TouchableOpacity
            onPress={() => canModify() && setShowTalukPicker(true)}
            style={[styles.selector, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}
            activeOpacity={0.7}
         >
            <Text style={{ color: selectedTaluk ? colors.text : colors.textSecondary, fontSize: 15 }}>
               {selectedTaluk || 'Select Taluk'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
         </TouchableOpacity>

         {!editUid && (
           <AppInput
              label="INITIAL PASSWORD *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minimum 6 characters"
              editable={canModify()}
           />
         )}

         {editUid && (
           <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Account Status (Active)</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} disabled={!canModify()} />
           </View>
         )}

         {canModify() && (
           <AppButton
              title={editUid ? "Save Changes" : "Create Taluk Admin"}
              onPress={onSubmit}
              loading={busy}
              style={{ marginTop: 32 }}
           />
         )}
      </ScrollView>

      <PickerSheet
         visible={showTalukPicker}
         title="Select Taluk Jurisdiction"
         options={KERALA_TALUKS}
         value={selectedTaluk}
         onSelect={(v) => { setSelectedTaluk(v); setShowTalukPicker(false); }}
         onClose={() => setShowTalukPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  selector: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 24 },
});
