import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';
import { useAuth } from '../../../src/context/auth';
import { listWards, listWardAdmins, checkMobileUnique, updateWardAdmin, createWardAdmin, type User, type Ward } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';

export default function AddEditWardAdmin() {
  const { colors } = useTheme();
  const { canModify } = useAuth();
  const router = useRouter();
  const { wardNumber, editUid } = useLocalSearchParams<{ wardNumber?: string, editUid?: string }>();

  const [wards, setWards] = useState<Ward[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedWard, setSelectedWard] = useState<number | null>(wardNumber ? parseInt(wardNumber) : null);
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [showWardPicker, setShowWardPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const wList = await listWards();
        setWards(wList);

        if (editUid) {
           const admins = await listWardAdmins();
           const admin = admins.find(a => a.uid === editUid);
           if (admin) {
              setName(admin.fullName);
              setEmail(admin.email);
              setMobile(admin.mobile);
              setSelectedWard(admin.wardNumber);
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

  const wardLabel = selectedWard ? wards.find(w => w.wardNumber === selectedWard)?.name : 'Select Ward';

  const goHome = () => {
    router.replace('/admin/super');
  };

  const onSubmit = async () => {
    if (!name.trim()) return showToast('Enter name', 'error');
    if (!email.trim()) return showToast('Enter email', 'error');
    if (!mobile || mobile.length !== 10) return showToast('Enter valid 10-digit mobile', 'error');
    if (!selectedWard) return showToast('Select ward', 'error');
    if (!editUid && password.length < 6) return showToast('Password min 6 chars', 'error');

    setBusy(true);
    try {
      const isUnique = await checkMobileUnique(mobile, editUid || undefined);
      if (!isUnique) {
        setBusy(false);
        return showToast('Mobile number already in use', 'error');
      }

      if (editUid) {
        await updateWardAdmin(editUid, {
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          isActive
        });
        showToast('Admin updated successfully', 'success');
      } else {
        // Validation: Only one active admin per ward
        const existing = await listWardAdmins();
        const activeInWard = existing.find(a => a.wardNumber === selectedWard && a.isActive);
        if (activeInWard) {
          throw new Error(`Ward ${selectedWard} already has an active administrator (${activeInWard.fullName})`);
        }

        const wardObj = wards.find(w => w.wardNumber === selectedWard)!;
        await createWardAdmin({
          fullName: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          wardNumber: selectedWard,
          wardName: wardObj.name,
          password
        });
        showToast('Ward Admin created successfully', 'success');
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{editUid ? 'Edit Ward Admin' : 'Add Ward Admin'}</Text>
        <TouchableOpacity onPress={goHome}>
          <Ionicons name="home" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <FormField label="FULL NAME *">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.textSecondary}
              editable={canModify()}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, opacity: canModify() ? 1 : 0.6 }]}
            />
          </FormField>

          <FormField label="EMAIL ADDRESS *">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@mycomplaints.in"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!editUid && canModify()}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, opacity: (editUid || !canModify()) ? 0.6 : 1 }]}
            />
          </FormField>

          <FormField label="MOBILE NUMBER *">
            <TextInput
              value={mobile}
              onChangeText={(val) => setMobile(val.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10 digit mobile"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              editable={canModify()}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, opacity: canModify() ? 1 : 0.6 }]}
            />
          </FormField>

          <FormField label="WARD ASSIGNMENT *">
            <TouchableOpacity
              onPress={() => !editUid && canModify() && setShowWardPicker(true)}
              style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border, opacity: (editUid || !canModify()) ? 0.6 : 1 }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: selectedWard ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {selectedWard ? `Ward ${selectedWard}: ${wardLabel}` : 'Select Ward'}
              </Text>
              {!editUid && canModify() && <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />}
            </TouchableOpacity>
            {editUid && <Text style={{fontSize: 11, color: colors.textSecondary, marginTop: 4}}>Ward cannot be changed for existing accounts</Text>}
          </FormField>

          {!editUid && (
            <FormField label="TEMPORARY PASSWORD *">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
            </FormField>
          )}

          {editUid && (
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
          )}

          {canModify() ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={onSubmit}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{editUid ? 'Save Changes' : 'Create Account'}</Text>}
            </TouchableOpacity>
          ) : (
            <View style={[styles.primaryBtn, { backgroundColor: colors.surfaceTint, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]}>
               <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Form in Read-Only Mode</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showWardPicker}
        title="Select Ward"
        options={(wards || []).map(w => `${w.wardNumber} - ${w.name}`)}
        onSelect={(val) => {
          const num = parseInt(val.split(' - ')[0]);
          setSelectedWard(num);
        }}
        onClose={() => setShowWardPicker(false)}
      />
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800' },
  body: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 56, fontSize: 16 },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 56 },
  primaryBtn: { marginTop: 32, height: 56, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
