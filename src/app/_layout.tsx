import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { router, SplashScreen, Stack, useRootNavigationState, useSegments } from 'expo-router';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../theme';
import { useStore } from '../store';
import { useSession } from '../api/useSession';
import { useAuth } from '../auth/useAuth';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
  });
  const ready = useStore((s) => s.ready);
  const loadAll = useStore((s) => s.loadAll);
  const segments = useSegments();
  const navReady = useRootNavigationState()?.key;
  const segKey = segments.join('/');
  const authInit = useAuth((s) => s.init);
  const authReady = useAuth((s) => s.initialized);
  const hasPin = useAuth((s) => s.hasPin);
  const locked = useAuth((s) => s.locked);
  const markBackground = useAuth((s) => s.markBackground);
  const checkAutoLock = useAuth((s) => s.checkAutoLock);
  const sessionStatus = useSession((s) => s.status);
  const sessionBootstrap = useSession((s) => s.bootstrap);

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  useEffect(() => {
    authInit().catch(() => undefined);
  }, [authInit]);

  useEffect(() => {
    sessionBootstrap().catch(() => undefined);
  }, [sessionBootstrap]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') markBackground();
      if (state === 'active') checkAutoLock();
    });
    return () => sub.remove();
  }, [markBackground, checkAutoLock]);

  useEffect(() => {
    if (!authReady || !ready || !navReady || sessionStatus === 'loading') return;
    const group = segments[0];
    const screen = segments.at(1);
    if (!hasPin) {
      if (screen !== 'setup') router.replace('/(auth)/setup');
    } else if (locked) {
      if (screen !== 'unlock') router.replace('/(auth)/unlock');
    } else if (sessionStatus === 'guest') {
      if (screen !== 'login') router.replace('/(auth)/login');
    } else if (group === '(auth)') {
      router.replace('/(tabs)');
    }
  }, [authReady, ready, navReady, hasPin, locked, sessionStatus, segKey]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && ready && authReady && sessionStatus !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, ready, authReady, sessionStatus]);

  if ((!fontsLoaded && !fontError) || !ready || !authReady || sessionStatus === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={Colors.accent}
          accessibilityLabel="Memuat PentungScore"
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.base },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="create"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="game/[id]"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
