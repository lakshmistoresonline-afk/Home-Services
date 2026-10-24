import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../../src/context/auth';
import { useTheme } from '@/src/theme';

export default function SuperAdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'super_admin' && user.role !== 'readonly_super_admin') {
        // Requirement 9: If not authorized, redirect to correct dashboard
        if (user.role === 'ward_admin' || user.role === 'staff') {
          router.replace('/admin');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    }
  }, [user, loading, router]);

  if (loading || !user || (user.role !== 'super_admin' && user.role !== 'readonly_super_admin')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
