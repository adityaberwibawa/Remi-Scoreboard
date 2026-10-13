/**
 * TASK 02.4/02.5 — Contoh request ke protected endpoint GET /scores.
 * Token ditempel otomatis oleh apiFetch. 401 → auto logout + ke /login.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { Colors, Common, FontFamily, Radius } from '../../theme';
import { fetchScores } from '../../api/authApi';
import { ApiError } from '../../api/config';
import type { Score } from '../../api/config';
import { useApiAuth } from '../../context/AuthContext';

export default function ScoresScreen() {
  const { token, logout, user } = useApiAuth();
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setScores(await fetchScores());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await logout(); // token basi → bersihkan + redirect (di logout)
        return;
      }
      setError(e instanceof Error ? e.message : 'Gagal memuat skor.');
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Belum login API → jangan tembak endpoint, arahkan ke login.
  if (!token) {
    return (
      <View style={Common.screen}>
        <AppHeader title="Skor" subtitle={user?.name ?? 'Butuh login API'} />
        <View style={[Common.content, styles.body]}>
          <View style={styles.card}>
            <Text style={styles.muted}>Kamu belum login. Endpoint /scores butuh token.</Text>
            <AppButton label="Ke Halaman Login" onPress={() => router.replace('/login')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={Common.screen}>
      <AppHeader title="Skor" subtitle="Data dari GET /scores (protected)" />
      <View style={[Common.content, styles.body]}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} accessibilityLabel="Memuat skor" />
        ) : error ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <AppButton label="Coba Lagi" onPress={load} variant="ghost" />
          </View>
        ) : (
          <FlatList
            data={scores}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.muted}>
                  Total {item.total}
                  {item.winner ? ` • Pemenang: ${item.winner}` : ''}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.muted}>Belum ada skor.</Text>}
          />
        )}
        <AppButton label="Muat Ulang" onPress={load} variant="ghost" />
        <AppButton label="Logout" onPress={logout} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  list: { gap: 10 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 6,
  },
  title: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  muted: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13 },
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
});
