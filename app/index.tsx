import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { useAuth } from '../src/context/auth';
import { useTheme } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { colors, typography } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'super_admin' || user.role === 'readonly_super_admin') {
        router.replace('/admin/super');
      } else if (user.role === 'staff' || user.role === 'ward_admin') {
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    }
  }, [mounted, user, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body.medium, { color: colors.textSecondary, marginTop: 16 }]}>
        Loading your experience...
      </Text>
    </View>
  );
}
