import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
import { showToast } from '@/src/components/Toast';
import { PickerSheet } from '@/src/components/PickerSheet';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ward, setWard] = useState('');
  const [showWard, setShowWard] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const wardOptions = THRISSUR_WARDS.map(w => `${w.wardNumber} - ${w.name}`);

  const onSubmit = async () => {
    if (!name.trim() || name.trim().length < 3) return showToast('Enter your full name (min 3 chars)', 'error');

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) return showToast('Email is required', 'error');
    const emailOk = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailNorm);
    if (!emailOk) return showToast('Enter a valid email address', 'error');

    if (!mobile || mobile.length !== 10) return showToast('Enter a valid 10-digit mobile number', 'error');

    if (password.length < 6) return showToast('Password min 6 characters', 'error');
    if (password !== confirmPassword) return showToast('Passwords do not match', 'error');

    if (!ward) return showToast('Please select your ward', 'error');

    setBusy(true);
    try {
      const selectedWardName = ward.includes(' - ') ? ward.split(' - ')[1] : ward;
      await register({ full_name: name.trim(), email: emailNorm, mobile, password, wardName: selectedWardName });
      showToast('Account created!', 'success');
      router.replace('/(tabs)/home');
    } catch (e: any) {
      showToast(e.message || 'Registration failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="register-back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          accessibilityRole={Platform.OS === 'web' ? 'form' : undefined}
        >
          <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Join to submit and track your civic complaints.
          </Text>

          <FormField label="FULL NAME *">
            <TextInput
              testID="register-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rohan Sharma"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          </FormField>

          <FormField label="EMAIL ADDRESS *">
            <TextInput
              testID="register-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          </FormField>

          <FormField label="MOBILE NUMBER *">
            <TextInput
              testID="register-mobile-input"
              value={mobile}
              onChangeText={(val) => setMobile(val.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          </FormField>

          <FormField label="WARD SELECTION *">
            <TouchableOpacity
              testID="ward-picker"
              onPress={() => setShowWard(true)}
              style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: ward ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {ward || 'Select your ward'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </FormField>

          <FormField label="PASSWORD *">
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                testID="register-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textSecondary}
                style={[styles.inputInline, { color: colors.text }]}
              />
              <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </FormField>

          <FormField label="CONFIRM PASSWORD *">
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                testID="register-confirm-password-input"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                placeholder="Repeat password"
                placeholderTextColor={colors.textSecondary}
                style={[styles.inputInline, { color: colors.text }]}
              />
            </View>
          </FormField>

          <TouchableOpacity
            testID="register-submit-button"
            activeOpacity={0.85}
            disabled={busy}
            onPress={onSubmit}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            testID="link-to-login"
            style={{ marginTop: 20, alignItems: 'center' }}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.textSecondary }}>
              Already have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showWard}
        title="Select Ward"
        options={wardOptions}
        value={ward}
        onSelect={setWard}
        onClose={() => setShowWard(false)}
        testIDPrefix="ward"
      />
    </SafeAreaView>
  );
}

function FormField({
  label,
  children,
  testID,
}: {
  label: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }} testID={testID}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 8 },
  body: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 28 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputInline: { flex: 1, fontSize: 16, paddingVertical: 0 },
  primaryBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
