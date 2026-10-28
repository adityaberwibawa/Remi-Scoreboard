import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { apiErrorMessage, isSessionExpired, normalizeApiError } from '../../api/errors';
import { AccountApi } from '../../auth/accountApi';
import type { AccountUser } from '../../auth/accountApi';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { StatusBanner } from '../../components/StatusBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { parseSnapshot } from '../../sync/snapshot';
import type { Snapshot } from '../../sync/snapshot';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius, Soft } from '../../theme';
import { useStore } from '../../store';

type Mode = 'login' | 'register';
type BootState = 'checking' | 'ready' | 'blocked';
type BusyAction = 'auth' | 'logout' | 'backup' | 'restore' | null;
type ConfirmAction = 'logout' | 'backup' | 'restore' | 'applyRestore' | null;

/** Instance API akun; null bila build tidak punya URL backend yang valid. */
const ACCOUNT_API = (() => {
  if (!DEFAULT_BASE_URL) return null;
  try {
    return new AccountApi(DEFAULT_BASE_URL);
  } catch {
    return null;
  }
})();

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Tab Akun: login/daftar, profil, serta cadangkan & pulihkan snapshot cloud. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const network = useNetworkStatus();
  const offline = network === 'offline';
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const applySnapshot = useStore((s) => s.applySnapshot);

  const [bootAttempt, setBootAttempt] = useState(0);
  const [boot, setBoot] = useState<BootState>('checking');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [bootNotice, setBootNotice] = useState<{ tone: 'offline' | 'info'; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    snapshot: Snapshot;
    updatedAt: string | null;
  } | null>(null);

  const busy = busyAction !== null;

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!ACCOUNT_API) {
        if (alive) setBoot('ready');
        return;
      }
      try {
        const signedIn = await ACCOUNT_API.hasSession();
        if (!alive) return;
        if (!signedIn) {
          setUser(null);
          setBoot('ready');
          return;
        }
        // Saat sudah diketahui offline, jangan tunggu timeout jaringan.
        if (offline) {
          const cached = await ACCOUNT_API.getCachedUser().catch(() => null);
          if (!alive) return;
          if (cached) {
            setUser(cached);
            setBoot('ready');
            setBootNotice({
              tone: 'offline',
              text: 'Mode offline — menampilkan profil akun tersimpan. Cadangan cloud butuh internet.',
            });
          } else {
            setBoot('blocked');
            setError('Profil akun belum bisa dimuat. Sambungkan internet lalu coba lagi.');
          }
          return;
        }
        const profile = await ACCOUNT_API.currentUser();
        if (!alive) return;
        setUser(profile);
        setBoot('ready');
        setBootNotice(null);
      } catch (e) {
        if (!alive) return;
        const apiError = normalizeApiError(e);
        if (isSessionExpired(apiError)) {
          setUser(null);
          setBoot('ready');
          setNotice('Sesi sudah berakhir. Silakan masuk kembali.');
          return;
        }
        const cached = await ACCOUNT_API.getCachedUser().catch(() => null);
        if (!alive) return;
        if (cached) {
          setUser(cached);
          setBoot('ready');
          setBootNotice({
            tone: apiError.kind === 'offline' || apiError.kind === 'timeout' ? 'offline' : 'info',
            text:
              apiError.kind === 'offline' || apiError.kind === 'timeout'
                ? 'Mode offline — menampilkan profil akun tersimpan. Cadangan cloud butuh internet.'
                : 'Gagal memperbarui profil. Menampilkan profil terakhir yang tersimpan.',
          });
          return;
        }
        setBoot('blocked');
        setError(apiErrorMessage(apiError, 'Gagal memuat profil akun.'));
      }
    }
    void run();
    return () => {
      alive = false;
    };
  }, [bootAttempt, offline]);

  const retryBoot = () => {
    setBoot('checking');
    setError(null);
    setNotice(null);
    setBootNotice(null);
    setBootAttempt((n) => n + 1);
  };

  const submitAuth = async () => {
    if (!ACCOUNT_API || busy || offline) return;
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

    setBusyAction('auth');
    setError(null);
    setNotice(null);
    try {
      const tokens =
        mode === 'register'
          ? await ACCOUNT_API.register(cleanName, cleanEmail, password)
          : await ACCOUNT_API.login(cleanEmail, password);
      setUser(tokens.user);
      setBoot('ready');
      setBootNotice(null);
      setPassword('');
      setNotice(
        mode === 'register'
          ? 'Akun berhasil dibuat. Kamu sudah masuk.'
          : `Selamat datang kembali, ${tokens.user.name}.`,
      );
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal masuk. Coba lagi.'));
    } finally {
      setBusyAction(null);
    }
  };

  const doLogout = async () => {
    if (!ACCOUNT_API) return;
    setBusyAction('logout');
    setError(null);
    setNotice(null);
    try {
      await ACCOUNT_API.logout({ remote: !offline });
    } catch {
      // Token lokal sudah dihapus oleh AccountApi.logout(); kegagalan jaringan tidak menghalangi keluar.
    } finally {
      setUser(null);
      setPassword('');
      setLastSynced(null);
      setBoot('ready');
      setBootNotice(null);
      setBusyAction(null);
      setNotice('Kamu sudah keluar dari akun.');
    }
  };

  const doBackup = async () => {
    if (!ACCOUNT_API || offline) return;
    setBusyAction('backup');
    setError(null);
    setNotice(null);
    try {
      const updatedAt = await ACCOUNT_API.pushSnapshot(players, sessions);
      setLastSynced(updatedAt);
      setNotice(`Cadangan tersimpan: ${players.length} pemain, ${sessions.length} sesi.`);
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal mencadangkan. Coba lagi.'));
    } finally {
      setBusyAction(null);
    }
  };

  const applyRestore = async (snapshot: Snapshot, updatedAt: string | null) => {
    setBusyAction('restore');
    setError(null);
    setNotice(null);
    try {
      const storeError = await applySnapshot(snapshot.players, snapshot.sessions);
      if (storeError) {
        setError(storeError);
        return;
      }
      setLastSynced(updatedAt);
      setNotice(
        `Cadangan dipulihkan: ${snapshot.players.length} pemain, ${snapshot.sessions.length} sesi.`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const fetchRestore = async () => {
    if (!ACCOUNT_API || offline) return;
    setBusyAction('restore');
    setError(null);
    setNotice(null);
    try {
      const data = await ACCOUNT_API.pullSnapshot();
      const snapshot = parseSnapshot(data);
      if (snapshot.players.length === 0 && snapshot.sessions.length === 0) {
        setNotice('Belum ada cadangan di akun ini.');
        return;
      }
      setPendingRestore({ snapshot, updatedAt: data.updatedAt });
      setConfirm('applyRestore');
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal mengunduh cadangan. Coba lagi.'));
    } finally {
      setBusyAction(null);
    }
  };

  const confirmLogout = () => {
    if (!ACCOUNT_API || busy) return;
    setConfirm('logout');
  };

  const confirmBackup = () => {
    if (!ACCOUNT_API || !user || busy || offline) return;
    setConfirm('backup');
  };

  const confirmRestore = () => {
    if (!ACCOUNT_API || !user || busy || offline) return;
    setConfirm('restore');
  };

  const closeConfirm = () => {
    setConfirm(null);
    if (confirm === 'applyRestore') setPendingRestore(null);
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
            {offline ? (
              <StatusBanner
                tone="offline"
                text="Kamu sedang offline. Data lokal tetap aman; masuk, daftar, dan cadangan cloud butuh internet."
                style={styles.banner}
              />
            ) : null}
            {bootNotice ? (
              <StatusBanner
                tone={bootNotice.tone === 'offline' ? 'offline' : 'info'}
                text={bootNotice.text}
                style={styles.banner}
              />
            ) : null}
            {error ? <StatusBanner tone="error" text={error} style={styles.banner} /> : null}
            {notice ? <StatusBanner tone="success" text={notice} style={styles.banner} /> : null}

            {boot === 'checking' ? (
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
                    label="Cadangkan Sekarang"
                    loading={busyAction === 'backup'}
                    loadingLabel="Mencadangkan…"
                    disabled={busy || offline}
                    disabledReason={
                      offline ? 'Cadangan cloud butuh koneksi internet.' : 'Tunggu proses sebelumnya selesai.'
                    }
                    onPress={confirmBackup}
                  />
                  <AppButton
                    label="Pulihkan dari Cloud"
                    variant="ghost"
                    loading={busyAction === 'restore'}
                    loadingLabel="Memproses…"
                    disabled={busy || offline}
                    disabledReason={
                      offline ? 'Pemulihan cloud butuh koneksi internet.' : 'Tunggu proses sebelumnya selesai.'
                    }
                    onPress={confirmRestore}
                  />
                  <AppButton
                    label="Keluar dari Akun"
                    variant="danger"
                    loading={busyAction === 'logout'}
                    loadingLabel="Keluar…"
                    disabled={busy}
                    disabledReason="Tunggu proses sebelumnya selesai."
                    onPress={confirmLogout}
                  />
                </View>
              </>
            ) : boot === 'blocked' ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Profil akun belum bisa dimuat
                </Text>
                <Text style={styles.mutedText}>
                  Sesi tersimpan di perangkat ini, tetapi profilnya belum bisa diambil. Periksa
                  koneksi lalu coba lagi.
                </Text>
                <AppButton label="Coba Lagi" loading={busy} onPress={retryBoot} />
                <AppButton
                  label="Keluar dari Akun"
                  variant="ghost"
                  disabled={busy}
                  disabledReason="Tunggu proses sebelumnya selesai."
                  onPress={confirmLogout}
                />
              </View>
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
                  label={mode === 'login' ? 'Masuk' : 'Daftar'}
                  loading={busyAction === 'auth'}
                  loadingLabel={mode === 'login' ? 'Masuk…' : 'Mendaftar…'}
                  disabled={busy || offline}
                  disabledReason={
                    offline ? 'Masuk dan daftar butuh koneksi internet.' : 'Tunggu proses sebelumnya selesai.'
                  }
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

      <ConfirmSheet
        visible={confirm === 'logout'}
        title="Keluar dari akun?"
        message="Cadangan di cloud tetap tersimpan. Data di perangkat ini tidak dihapus."
        confirmLabel="Keluar"
        destructive
        onCancel={closeConfirm}
        onConfirm={async () => {
          setConfirm(null);
          await doLogout();
        }}
      />
      <ConfirmSheet
        visible={confirm === 'backup'}
        title="Cadangkan ke cloud?"
        message={`Cadangan berisi ${players.length} pemain dan ${sessions.length} sesi. Cadangan sebelumnya di akun ${user?.email ?? ''} akan diganti.`}
        confirmLabel="Cadangkan"
        onCancel={closeConfirm}
        onConfirm={async () => {
          setConfirm(null);
          await doBackup();
        }}
      />
      <ConfirmSheet
        visible={confirm === 'restore'}
        title="Pulihkan dari cloud?"
        message="Cadangan terakhir akun ini akan diunduh dulu. Data lokal baru diganti setelah kamu menyetujui."
        confirmLabel="Unduh"
        onCancel={closeConfirm}
        onConfirm={async () => {
          setConfirm(null);
          await fetchRestore();
        }}
      />
      <ConfirmSheet
        visible={confirm === 'applyRestore'}
        title="Ganti data lokal?"
        message={`Cadangan berisi ${pendingRestore?.snapshot.players.length ?? 0} pemain dan ${pendingRestore?.snapshot.sessions.length ?? 0} sesi. Data lokal saat ini akan diganti seluruhnya.`}
        confirmLabel="Pulihkan"
        destructive
        onCancel={closeConfirm}
        onConfirm={async () => {
          const pending = pendingRestore;
          setConfirm(null);
          setPendingRestore(null);
          if (pending) await applyRestore(pending.snapshot, pending.updatedAt);
        }}
      />
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
  banner: { marginBottom: 12 },
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
