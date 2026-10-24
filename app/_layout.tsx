import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox, StatusBar, View, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { AuthProvider } from '@/src/context/auth';
import { ToastHost } from '@/src/components/Toast';
import { useTheme } from '@/src/theme';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

const DeveloperBanner = React.memo(() => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      backgroundColor: colors.surface,
      paddingBottom: Math.max(insets.bottom, 12),
      paddingTop: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border
    }}>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
        Designed & Developed by Subramanian T S, WebCraft Digital Solutions
      </Text>
    </View>
  );
});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
            <DeveloperBanner />
          </View>
          <ToastHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
