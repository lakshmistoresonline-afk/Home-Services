import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { useTheme } from '@/src/theme';
import { THRISSUR_WARDS } from '@/src/data/wards';
import { checkMobileUnique, updateProfile, deleteOwnAccount, changePassword } from '@/src/api';
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';
import { AppCard } from '@/src/components/AppCard';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [wardName, setWardName] = useState(user?.wardName || '');
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const wardOptions = THRISSUR_WARDS.map(w => `${w.wardNumber} - ${w.name}`);

  useEffect(() => {
    if (user) {
      setName(user.fullName);
      setEmail(user.email);
      setMobile(user.mobile);
      setWardName(user.wardName ? `${user.wardNumber} - ${user.wardName}` : '');
    }
  }, [user]);

  const saveProfile = async () => {
    if (!name.trim()) return showToast('Enter your name', 'error');
    if (!email.trim()) return showToast('Enter your email', 'error');
    if (!mobile || mobile.length !== 10) {
      return showToast('Enter a valid 10-digit mobile number', 'error');
    }

    setSaving(true);
    try {
      const isUnique = await checkMobileUnique(mobile, user?.uid);
      if (!isUnique) {
        setSaving(false);
        return showToast('Mobile number already registered', 'error');
      }

      const selectedWardName = wardName.split(' - ')[1];
      const ward = THRISSUR_WARDS.find(w => w.name === selectedWardName);
      const wardNumber = ward ? ward.wardNumber : null;

      const updated = await updateProfile({
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        wardNumber: wardNumber as any,
        wardName: selectedWardName
      });
      setUser(updated);
      showToast('Profile updated', 'success');
    } catch (e: any) {
      showToast(e.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doChangePassword = async () => {
    if (newPw.length < 6) return showToast('New password min 6 chars', 'error');
    setPwBusy(true);
    try {
      await changePassword({ current_password: currentPw, new_password: newPw });
      showToast('Password changed', 'success');
      setShowPwModal(false);
      setCurrentPw('');
      setNewPw('');
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setPwBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      setShowLogoutSheet(false);
      await logout();
    } catch (e) {
      console.warn('Logout error handled:', e);
    } finally {
      router.replace('/(auth)/login');
    }
  };

  const doDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteOwnAccount();
      showToast('Your account has been deleted', 'success');
      setShowDeleteSheet(false);
      await logout();
      router.replace('/(auth)/login');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const goHome = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>MY ACCOUNT</Text>
          <Text style={[styles.hello, { color: colors.text }]}>Profile Settings</Text>
        </View>
        <TouchableOpacity
          onPress={doLogout}
          style={[styles.headerIconBtn, { backgroundColor: colors.danger + '10' }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, paddingTop: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarGlow, { backgroundColor: colors.primary + '10' }]} />
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(user?.fullName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.avatarName, { color: colors.text }]}>{user?.fullName}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{user?.email}</Text>

            {user?.wardName && user?.role !== 'staff' && (
              <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                  WARD {user.wardNumber}: {user.wardName.toUpperCase()}
                </Text>
              </View>
            )}
            {user?.role === 'staff' && (
              <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                  STAFF JURISDICTION: {user.hasAllWardAccess ? 'ALL WARDS' : (user.assignedWardNumbers.join(', ') || 'NONE')}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PERSONAL INFORMATION</Text>
          <AppCard elevation="sm" padding="md">
            <AppInput
              label="FULL NAME"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
            />
            <AppInput
              label="EMAIL ADDRESS"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />
            <AppInput
              label="MOBILE NUMBER"
              value={mobile}
              onChangeText={(val) => setMobile(val.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
            />

            <Text style={styles.inputLabel}>WARD JURISDICTION</Text>
            {user?.role === 'staff' ? (
              <View style={[styles.readOnlyInput, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  Managed by Administrator
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowWardPicker(true)}
                style={[styles.selector, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: wardName ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {wardName || 'Select your ward'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {user?.role !== 'staff' && (
              <AppButton
                title="Save Changes"
                onPress={saveProfile}
                loading={saving}
                style={{ marginTop: 24 }}
              />
            )}
          </AppCard>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 32 }]}>SECURITY & PRIVACY</Text>
          <AppCard elevation="sm" padding="none">
            <TouchableOpacity
              onPress={() => setShowPwModal(true)}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="key-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Change Password</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Update your account security</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              onPress={() => setShowLogoutSheet(true)}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.danger + '10' }]}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.danger }}>Logout</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Sign out of your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>
          </AppCard>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 32 }]}>DANGER ZONE</Text>
          <AppCard style={{ borderColor: colors.danger + '33', borderWidth: 1 }} elevation="none" padding="md">
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 16 }}>
              Deleting your account is permanent and cannot be undone. All your data will be anonymized.
            </Text>
            <AppButton
              title="Delete My Account"
              variant="outline"
              onPress={() => setShowDeleteSheet(true)}
              style={{ borderColor: colors.danger }}
              textStyle={{ color: colors.danger }}
            />
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showWardPicker}
        title="Select Ward"
        options={wardOptions}
        value={wardName}
        onSelect={setWardName}
        onClose={() => setShowWardPicker(false)}
        testIDPrefix="profile-ward"
      />

      {/* Change password modal */}
      <Modal transparent visible={showPwModal} animationType="fade" onRequestClose={() => setShowPwModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPwModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
            <View style={{ marginTop: 20 }}>
              <AppInput
                label="CURRENT PASSWORD"
                value={currentPw}
                onChangeText={setCurrentPw}
                secureTextEntry
              />
              <AppInput
                label="NEW PASSWORD"
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <AppButton
                title="Cancel"
                variant="outline"
                onPress={() => setShowPwModal(false)}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Save"
                onPress={doChangePassword}
                loading={pwBusy}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Logout confirm sheet */}
      <Modal transparent visible={showLogoutSheet} animationType="fade" onRequestClose={() => setShowLogoutSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLogoutSheet(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign out?</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 14, lineHeight: 20 }}>
              You will need to sign in again to access your complaints and track status.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <AppButton
                title="Stay"
                variant="outline"
                onPress={() => setShowLogoutSheet(false)}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Sign out"
                variant="danger"
                onPress={doLogout}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete account confirm sheet */}
      <Modal transparent visible={showDeleteSheet} animationType="fade" onRequestClose={() => setShowDeleteSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !deleting && setShowDeleteSheet(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash" size={30} color={colors.danger} />
              </View>
            </View>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>Delete your account?</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>
              This action is permanent. Your name will be anonymized on all historical records. You will lose access immediately.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <AppButton
                title="Keep Account"
                variant="outline"
                onPress={() => setShowDeleteSheet(false)}
                disabled={deleting}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Delete"
                variant="danger"
                onPress={doDeleteAccount}
                loading={deleting}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  hello: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  avatarName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  roleBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
    marginTop: 8,
  },
  readOnlyInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 28,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
