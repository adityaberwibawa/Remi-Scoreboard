import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { StatusBanner } from '../../components/StatusBanner';
import { useAuthSession } from '../../auth/AuthContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius } from '../../theme';

type Mode = 'login' | 'register';

/** Layar masuk/daftar — satu-satunya titik masuk sebelum aplikasi terbuka. */
export default function SignInScreen() {
  const { configured, signIn, signUp } = useAuthSession();
  const network = useNetworkStatus();
  const offline = network === 'offline';

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (busy || offline) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Alamat email tidak valid.');
      return;
    }
    if (mode === 'register') {
      if (cleanName.length < 2 || cleanName.length > 80) {
        setError('Nama harus berisi 2 sampai 80 karakter.');
        return;
      }
      if (password.length < 8 || password.length > 128) {
        setError('Kata sandi harus berisi 8 sampai 128 karakter.');
        return;
      }
    } else if (password.length === 0) {
      setError('Kata sandi wajib diisi.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        // Sesi terbentuk → guard di root layout mengalihkan ke /(tabs).
        await signIn(cleanEmail, password);
        setPassword('');
      } else {
        const needsVerification = await signUp(cleanName, cleanEmail, password);
        setPassword('');
        if (needsVerification) {
          setMode('login');
          setNotice('Email verifikasi sudah dikirim. Buka tautannya, lalu masuk.');
        }
        // Tanpa verifikasi email, sesi langsung terbentuk → guard mengalihkan.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <View style={Common.screen}>
        <AppHeader title="Masuk" subtitle="Akun untuk cadangan cloud" />
        <View style={[Common.content, styles.body]}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Fitur akun belum aktif
            </Text>
            <Text style={styles.mutedText}>
              Build ini tidak memiliki konfigurasi Supabase. Atur
              EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY saat membangun
              aplikasi untuk mengaktifkan masuk, daftar, dan cadangan cloud.
            </Text>
            <AppButton
              label="Lanjut Tanpa Akun"
              variant="ghost"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={Common.screen}>
      <AppHeader title="Masuk" subtitle="Akun untuk cadangan cloud pemain & sesi" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {offline ? (
              <StatusBanner
                tone="offline"
                text="Kamu sedang offline. Masuk dan daftar butuh koneksi internet."
                style={styles.banner}
              />
            ) : null}
            {error ? <StatusBanner tone="error" text={error} style={styles.banner} /> : null}
            {notice ? <StatusBanner tone="success" text={notice} style={styles.banner} /> : null}

            <View accessibilityRole="tablist" style={styles.modeRow}>
              {(
                [
                  { value: 'login', label: 'Masuk' },
                  { value: 'register', label: 'Daftar' },
                ] as { value: Mode; label: string }[]
              ).map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === item.value }}
                  accessibilityLabel={item.label}
                  onPress={() => {
                    setMode(item.value);
                    setError(null);
                    setNotice(null);
                  }}
                  style={[styles.modeBtn, mode === item.value && styles.modeBtnActive]}>
                  <Text style={[styles.modeText, mode === item.value && styles.modeTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text accessibilityRole="header" style={styles.cardTitle}>
              {mode === 'login' ? 'Masuk ke Akun' : 'Buat Akun Baru'}
            </Text>

            {mode === 'register' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nama</Text>
                <TextInput
                  accessibilityLabel="Nama akun"
                  accessibilityHint="Minimal 2 karakter"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setError(null);
                  }}
                  placeholder="Nama panggilan"
                  placeholderTextColor={Colors.muted}
                  maxLength={80}
                  returnKeyType="next"
                  style={styles.input}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                accessibilityLabel="Email akun"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                placeholder="nama@contoh.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Kata sandi</Text>
              <TextInput
                accessibilityLabel="Kata sandi akun"
                accessibilityHint={
                  mode === 'register' ? 'Minimal 8 karakter' : 'Masukkan kata sandi akun'
                }
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder={mode === 'register' ? 'Minimal 8 karakter' : 'Kata sandi'}
                placeholderTextColor={Colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                returnKeyType="done"
                onSubmitEditing={submit}
                style={styles.input}
              />
            </View>

            <AppButton
              label={mode === 'login' ? 'Masuk' : 'Daftar'}
              loading={busy}
              loadingLabel={mode === 'login' ? 'Masuk…' : 'Mendaftar…'}
              disabled={busy || offline}
              disabledReason={
                offline
                  ? 'Masuk dan daftar butuh koneksi internet.'
                  : 'Tunggu proses sebelumnya selesai.'
              }
              onPress={submit}
            />
            <Text style={styles.hint}>
              {mode === 'login'
                ? 'Cadangan cloud hanya bisa dipakai setelah masuk.'
                : 'Akun dipakai untuk menyimpan cadangan pemain dan sesi.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 },
  body: { padding: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  mutedText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  banner: { marginBottom: 0 },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.base,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: { backgroundColor: Colors.raised },
  modeText: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  modeTextActive: { color: Colors.accent, fontFamily: FontFamily.bodySemi },
  field: { gap: 6 },
  fieldLabel: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontFamily: FontFamily.body,
    fontSize: 15,
    paddingHorizontal: 12,
  },
});
