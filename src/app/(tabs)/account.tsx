import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_BASE_URL } from '../../api/client';
import { AccountApi, AccountApiError } from '../../auth/accountApi';
import type { AccountUser } from '../../auth/accountApi';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { parseSnapshot } from '../../sync/snapshot';
import type { Snapshot } from '../../sync/snapshot';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius, Soft } from '../../theme';
import { useStore } from '../../store';

type Mode = 'login' | 'register';

/** Instance API akun; null bila build tidak punya URL backend yang valid. */
const ACCOUNT_API = (() => {
  if (!DEFAULT_BASE_URL) return null;
  try {
    return new AccountApi(DEFAULT_BASE_URL);
  } catch {
    return null;
  }
})();

function messageOf(error: unknown): string {
  if (error instanceof AccountApiError || error instanceof Error) return error.message;
  return 'Terjadi kesalahan. Coba lagi.';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Tab Akun: login/daftar, profil, serta cadangkan & pulihkan snapshot cloud. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const applySnapshot = useStore((s) => s.applySnapshot);

  const [bootAttempt, setBootAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!ACCOUNT_API) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const signedIn = await ACCOUNT_API.hasSession();
        if (!signedIn) {
          if (alive) setLoading(false);
          return;
        }
        const profile = await ACCOUNT_API.currentUser();
        if (alive) {
          setUser(profile);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setError(messageOf(e));
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      alive = false;
    };
  }, [bootAttempt]);

  const retryBoot = () => {
    setLoading(true);
    setError(null);
    setBootAttempt((n) => n + 1);
  };

  const submitAuth = async () => {
    if (!ACCOUNT_API || busy) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register' && (cleanName.length < 2 || cleanName.length > 80)) {
      setError('Nama harus berisi 2 sampai 80 karakter.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Alamat email tidak valid.');
      return;
    }
    if (mode === 'register' && (password.length < 8 || password.length > 128)) {
      setError('Kata sandi harus berisi 8 sampai 128 karakter.');
      return;
    }
    if (mode === 'login' && password.length === 0) {
      setError('Kata sandi wajib diisi.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const tokens =
        mode === 'register'
          ? await ACCOUNT_API.register(cleanName, cleanEmail, password)
          : await ACCOUNT_API.login(cleanEmail, password);
      setUser(tokens.user);
      setPassword('');
      setNotice(
        mode === 'register'
          ? 'Akun berhasil dibuat. Kamu sudah masuk.'
          : `Selamat datang kembali, ${tokens.user.name}.`,
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    if (!ACCOUNT_API) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ACCOUNT_API.logout();
    } catch {
      // Token lokal sudah dihapus oleh AccountApi.logout(); kegagalan jaringan tidak menghalangi keluar.
    } finally {
      setUser(null);
      setPassword('');
      setLastSynced(null);
      setBusy(false);
      setNotice('Kamu sudah keluar dari akun.');
    }
  };

  const confirmLogout = () => {
    if (!ACCOUNT_API || busy) return;
    Alert.alert(
      'Keluar dari akun?',
      'Cadangan di cloud tetap tersimpan. Data di perangkat ini tidak dihapus.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: () => void doLogout() },
      ],
    );
  };

  const doBackup = async () => {
    if (!ACCOUNT_API) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updatedAt = await ACCOUNT_API.pushSnapshot(players, sessions);
      setLastSynced(updatedAt);
      setNotice(`Cadangan tersimpan: ${players.length} pemain, ${sessions.length} sesi.`);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmBackup = () => {
    if (!ACCOUNT_API || !user || busy) return;
    Alert.alert(
      'Cadangkan ke cloud?',
      `Cadangan berisi ${players.length} pemain dan ${sessions.length} sesi. Cadangan sebelumnya di akun ${user.email} akan diganti.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Cadangkan', onPress: () => void doBackup() },
      ],
    );
  };

  const applyRestore = async (snapshot: Snapshot, updatedAt: string | null) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await applySnapshot(snapshot.players, snapshot.sessions);
      setLastSynced(updatedAt);
      setNotice(
        `Cadangan dipulihkan: ${snapshot.players.length} pemain, ${snapshot.sessions.length} sesi.`,
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const fetchRestore = async () => {
    if (!ACCOUNT_API) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await ACCOUNT_API.pullSnapshot();
      const snapshot = parseSnapshot(data);
      setBusy(false);
      if (snapshot.players.length === 0 && snapshot.sessions.length === 0) {
        setNotice('Belum ada cadangan di akun ini.');
        return;
      }
      Alert.alert(
        'Ganti data lokal?',
        `Cadangan berisi ${snapshot.players.length} pemain dan ${snapshot.sessions.length} sesi. Data lokal saat ini akan diganti seluruhnya.`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Pulihkan',
            style: 'destructive',
            onPress: () => void applyRestore(snapshot, data.updatedAt),
          },
        ],
      );
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  const confirmRestore = () => {
    if (!ACCOUNT_API || !user || busy) return;
    Alert.alert(
      'Pulihkan dari cloud?',
      'Cadangan terakhir akun ini akan diunduh dulu. Data lokal baru diganti setelah kamu menyetujui.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Unduh', onPress: () => void fetchRestore() },
      ],
    );
  };

  return (
    <View style={Common.screen}>
      <AppHeader title="Akun" subtitle="Cadangan cloud untuk pemain & sesi" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled">
          <View style={Common.content}>
            {error ? <Banner tone="error" text={error} /> : null}
            {notice ? <Banner tone="success" text={notice} /> : null}

            {loading ? (
              <View style={[styles.card, styles.centered]}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.mutedText}>Memeriksa sesi akun…</Text>
              </View>
            ) : !ACCOUNT_API ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Fitur akun belum aktif
                </Text>
                <Text style={styles.mutedText}>
                  Build ini tidak memiliki alamat backend. Atur EXPO_PUBLIC_API_URL saat membangun
                  aplikasi untuk mengaktifkan akun dan cadangan cloud.
                </Text>
                <AppButton label="Coba Lagi" variant="ghost" onPress={retryBoot} />
              </View>
            ) : user ? (
              <>
                <View style={styles.card}>
                  <View style={styles.profileRow}>
                    <View style={styles.profileIcon}>
                      <MaterialIcons name="person" size={26} color={Colors.accent} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.profileName}>{user.name}</Text>
                      <Text style={styles.profileEmail}>{user.email}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Masuk</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text accessibilityRole="header" style={styles.cardTitle}>
                    Cadangan Cloud
                  </Text>
                  <Text style={styles.mutedText}>
                    Data lokal: {players.length} pemain, {sessions.length} sesi.
                    {lastSynced ? ` Terakhir disinkronkan ${formatDate(lastSynced)}.` : ''}
                  </Text>
                  <AppButton
                    label={busy ? 'Memproses…' : 'Cadangkan Sekarang'}
                    disabled={busy}
                    disabledReason="Tunggu proses sebelumnya selesai."
                    onPress={confirmBackup}
                  />
                  <AppButton
                    label="Pulihkan dari Cloud"
                    variant="ghost"
                    disabled={busy}
                    disabledReason="Tunggu proses sebelumnya selesai."
                    onPress={confirmRestore}
                  />
                  <AppButton
                    label="Keluar dari Akun"
                    variant="danger"
                    disabled={busy}
                    disabledReason="Tunggu proses sebelumnya selesai."
                    onPress={confirmLogout}
                  />
                </View>
              </>
            ) : (
              <View style={styles.card}>
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
                      }}
                      style={[styles.modeBtn, mode === item.value && styles.modeBtnActive]}>
                      <Text
                        style={[styles.modeText, mode === item.value && styles.modeTextActive]}>
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
                    onSubmitEditing={submitAuth}
                    style={styles.input}
                  />
                </View>

                <AppButton
                  label={busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}
                  disabled={busy}
                  disabledReason="Tunggu proses sebelumnya selesai."
                  onPress={submitAuth}
                />
                <Text style={styles.hint}>
                  {mode === 'login'
                    ? 'Cadangan cloud hanya bisa dipakai setelah masuk.'
                    : 'Akun dipakai untuk menyimpan cadangan pemain dan sesi.'}
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="cloud-sync" size={18} color={Colors.accent} />
                <Text style={styles.infoText}>
                  Cadangan bersifat manual: tekan Cadangkan Sekarang kapan pun ingin menyimpan
                  salinan terbaru.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="photo" size={18} color={Colors.muted} />
                <Text style={styles.infoText}>
                  File foto avatar tidak ikut tersinkron. Setelah dipulihkan di perangkat lain,
                  avatar foto perlu dipilih ulang.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="lock" size={18} color={Colors.muted} />
                <Text style={styles.infoText}>
                  PIN aplikasi tetap tersimpan lokal di perangkat ini dan tidak dikirim ke server.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Banner({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  const isError = tone === 'error';
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}>
      <MaterialIcons
        name={isError ? 'error-outline' : 'check-circle-outline'}
        size={18}
        color={isError ? Colors.danger : Colors.accent}
      />
      <Text style={[styles.bannerText, isError ? styles.bannerTextError : styles.bannerTextSuccess]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: 12, paddingHorizontal: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  centered: { alignItems: 'center', paddingVertical: 28 },
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  mutedText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 12,
  },
  bannerError: { backgroundColor: Soft.dangerSoft, borderColor: Colors.danger },
  bannerSuccess: { backgroundColor: Soft.accentSoft, borderColor: Colors.accent },
  bannerText: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  bannerTextError: { color: Colors.danger },
  bannerTextSuccess: { color: Colors.accent },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Soft.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 16 },
  profileEmail: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13 },
  badge: {
    backgroundColor: Soft.accentSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 11 },
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
  infoCard: {
    backgroundColor: Colors.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 18 },
});
