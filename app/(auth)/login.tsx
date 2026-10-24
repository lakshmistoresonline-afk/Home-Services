import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { useTheme } from '@/src/theme';
import { showToast } from '@/src/components/Toast';

const APK_URL = 'https://github.com/lakshmistoresonline-afk/complaintsfirestore/releases/download/v1.0.0/MyComplaints.apk';

export default function LoginScreen() {
  const { login, user, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin' || user.role === 'readonly_super_admin') {
        router.replace('/admin/super');
      } else if (user.role === 'ward_admin' || user.role === 'staff') {
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    }
  }, [user, loading, router]);

  const onSubmit = async () => {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      showToast('Enter your email address', 'error');
      return;
    }
    const emailOk = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailNorm);
    if (!emailOk) {
      showToast('Enter a valid email address', 'error');
      return;
    }
    if (!password) {
      showToast('Enter your password', 'error');
      return;
    }
    setBusy(true);
    try {
      const u = await login(emailNorm, password);
      showToast('Welcome!', 'success');

      // Requirement 3: Role-based redirection
      if (u.role === 'super_admin' || u.role === 'readonly_super_admin') {
        router.replace('/admin/super');
      } else if (u.role === 'ward_admin' || u.role === 'staff') {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      showToast(e.message || 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Image
        source={require('@/assets/images/thrissur-corporation.jpg')}
        style={styles.hero}
      />
      <View style={[styles.heroOverlay, { backgroundColor: colors.primary + 'AA' }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Ionicons name="megaphone" size={22} color="#fff" />
          </View>
          <Text style={styles.brandName}>My Complaints</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          accessibilityRole={Platform.OS === 'web' ? 'form' : undefined}
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in with your email address
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="current-password"
                placeholder="Your password"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
              />
              <TouchableOpacity onPress={() => setShowPw((p) => !p)} testID="login-toggle-password">
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              onPress={onSubmit}
              activeOpacity={0.85}
              disabled={busy}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={{ color: colors.textSecondary }}>New here?</Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity testID="link-to-register">
                  <Text style={[styles.registerLink, { color: colors.primary }]}> Create account</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.downloadBtn, { borderColor: colors.border }]}
                onPress={() => Linking.openURL(APK_URL)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-android" size={20} color={colors.textSecondary} />
                <Text style={[styles.downloadText, { color: colors.textSecondary }]}>
                  Download Android App
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  brandRow: { flexDirection: 'row', alignItems: 'center', padding: 24, gap: 12 },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sheetWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8, marginTop: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  primaryBtn: {
    marginTop: 28,
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerLink: { fontWeight: '700' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 100,
    gap: 10,
    borderStyle: 'dashed',
  },
  downloadText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
