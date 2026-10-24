import React, { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db, auth } from '@/src/config/firebase';
import { useAuth } from '@/src/context/auth';
import { useTheme } from '@/src/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const { user, loading, hasPermission } = useAuth();
  const { colors, spacing, shadows, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", user.uid),
        where("read", "==", false)
      );
      const unsubscribe = onSnapshot(q,
        (snap) => {
          if (!auth.currentUser) return; // Ignore if user just logged out
          setUnreadCount(snap.size);
        },
        (error) => {
          if (error.code === 'permission-denied') return;
          console.error('Tabs notifications listener error:', error);
        }
      );
      return () => unsubscribe();
    }
  }, [user]);

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'super_admin' || user.role === 'readonly_super_admin') {
    return <Redirect href="/admin/super" />;
  }
  if (user.role === 'staff' || user.role === 'ward_admin') {
    return <Redirect href="/admin" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 12,
          ...shadows.lg,
          // Floating effect
          marginHorizontal: spacing.md,
          marginBottom: insets.bottom > 0 ? insets.bottom : spacing.md,
          borderRadius: radius.xl,
          position: 'absolute',
          left: 0,
          right: 0,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-sharp" size={size} color={color} />,
          href: user?.role === 'citizen' ? null : '/(tabs)/home',
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-sharp" size={size} color={color} />,
          href: user?.role === 'citizen' ? null : (hasPermission('view_own_complaints') ? undefined : null),
          tabBarButtonTestID: 'tab-complaints',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-sharp" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10, color: '#fff' },
          href: null,
          tabBarButtonTestID: 'tab-notifications',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-sharp" size={size} color={color} />,
          href: user?.role === 'citizen' ? null : undefined,
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}
