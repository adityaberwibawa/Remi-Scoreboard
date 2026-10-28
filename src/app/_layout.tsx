import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import {
  router,
  SplashScreen,
  Stack,
  useRootNavigationState,
  useSegments,
  type ErrorBoundaryProps,
} from 'expo-router';
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
import { useAuth } from '../auth/useAuth';
import { AppButton } from '../components/AppButton';
import { NetworkBanner } from '../components/NetworkBanner';
import { StatusBanner } from '../components/StatusBanner';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Fallback level rute: menangkap error render agar aplikasi tidak menjadi layar putih. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <StatusBanner tone="error" text={error.message || 'Terjadi kesalahan tak terduga.'} />
      <AppButton label="Coba Lagi" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
  });
  const [retryingLoad, setRetryingLoad] = useState(false);
  const ready = useStore((s) => s.ready);
  const hasLoadedOnce = useStore((s) => s.hasLoadedOnce);
  const loadError = useStore((s) => s.loadError);
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

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  useEffect(() => {
    authInit().catch(() => undefined);
  }, [authInit]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') markBackground();
      if (state === 'active') checkAutoLock();
    });
    return () => sub.remove();
  }, [markBackground, checkAutoLock]);

  useEffect(() => {
    if (!authReady || !ready || !navReady || loadError) return;
    const [group, screen] = segKey.split('/');
    if (!hasPin) {
      if (screen !== 'setup') router.replace('/(auth)/setup');
    } else if (locked) {
      if (screen !== 'unlock') router.replace('/(auth)/unlock');
    } else if (group === '(auth)') {
      router.replace('/(tabs)');
    }
  }, [authReady, ready, navReady, loadError, hasPin, locked, segKey]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && ready && authReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, ready, authReady]);

  if ((!fontsLoaded && !fontError) || !ready || !authReady) {
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

  // Gagal membuka database: jangan tampilkan data kosong seolah semuanya hilang.
  if (loadError && !hasLoadedOnce) {
    return (
      <View style={styles.errorScreen}>
        <StatusBanner tone="error" text={loadError} />
        <Text style={styles.errorHint}>
          Data pemain dan sesi tetap tersimpan di perangkat. Muat ulang untuk mencoba lagi.
        </Text>
        <AppButton
          label="Coba Lagi"
          loading={retryingLoad}
          loadingLabel="Memuat…"
          onPress={() => {
            setRetryingLoad(true);
            void loadAll().finally(() => setRetryingLoad(false));
          }}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.app}>
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
        <NetworkBanner />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: Colors.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: Colors.base,
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  errorHint: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
