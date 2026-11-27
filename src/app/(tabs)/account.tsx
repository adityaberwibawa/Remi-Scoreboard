import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_BASE_URL } from '../../api/client';
import { apiErrorMessage } from '../../api/errors';
import { AccountApi } from '../../auth/accountApi';
import { getDisplayName, useAuthSession } from '../../auth/AuthContext';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { StatusBanner } from '../../components/StatusBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { parseSnapshot } from '../../sync/snapshot';
import type { Snapshot } from '../../sync/snapshot';
import { Colors, Common, FontFamily, Radius, Soft } from '../../theme';
import { useStore } from '../../store';

type BusyAction = 'logout' | 'backup' | 'restore' | null;
type ConfirmAction = 'logout' | 'backup' | 'restore' | 'applyRestore' | null;

/** Instance API cadangan cloud; null bila build tidak punya URL backend yang valid. */
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

/** Tab Akun: profil sesi Supabase, keluar, serta cadangkan & pulihkan snapshot cloud. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const network = useNetworkStatus();
  const offline = network === 'offline';
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const applySnapshot = useStore((s) => s.applySnapshot);
  const { configured, status, user, signOut } = useAuthSession();

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
  const signedIn = configured && status === 'signedIn' && user !== null;

  const doLogout = async () => {
    setBusyAction('logout');
    setError(null);
    setNotice(null);
    try {
      await signOut();
      // Sesi berakhir → guard root mengalihkan ke layar masuk.
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal keluar. Coba lagi.'));
    } finally {
      setLastSynced(null);
      setBusyAction(null);
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
    if (busy) return;
    setConfirm('logout');
  };

  const confirmBackup = () => {
    if (!ACCOUNT_API || !signedIn || busy || offline) return;
    setConfirm('backup');
  };

  const confirmRestore = () => {
    if (!ACCOUNT_API || !signedIn || busy || offline) return;
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
                text="Kamu sedang offline. Data lokal tetap aman; keluar dan cadangan cloud butuh internet."
                style={styles.banner}
              />
            ) : null}
            {error ? <StatusBanner tone="error" text={error} style={styles.banner} /> : null}
            {notice ? <StatusBanner tone="success" text={notice} style={styles.banner} /> : null}

            {!configured ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Fitur akun belum aktif
                </Text>
                <Text style={styles.mutedText}>
                  Build ini tidak memiliki konfigurasi Supabase. Atur
                  EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY saat membangun
                  aplikasi untuk mengaktifkan akun dan cadangan cloud.
                </Text>
              </View>
            ) : !signedIn ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Belum masuk
                </Text>
                <Text style={styles.mutedText}>
                  Masuk ke akun untuk mencadangkan dan memulihkan data pemain serta sesi.
                </Text>
                <AppButton
                  label="Ke Layar Masuk"
                  onPress={() => router.replace('/sign-in')}
                />
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.profileRow}>
                    <View style={styles.profileIcon}>
                      <MaterialIcons name="person" size={26} color={Colors.accent} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.profileName}>{getDisplayName(user)}</Text>
                      <Text style={styles.profileEmail}>{user.email ?? ''}</Text>
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
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  mutedText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19 },
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
