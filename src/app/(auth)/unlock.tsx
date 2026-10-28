import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius } from '../../theme';
import { MAX_ATTEMPTS, PIN_LENGTH, remainingLockoutMs } from '../../auth/pin';
import { useAuth } from '../../auth/useAuth';

/** Waktu boot modul: dipakai sebagai nilai awal timer tanpa memanggil Date.now saat render. */
const BOOT_NOW = Date.now();

export default function UnlockScreen() {
  const unlock = useAuth((s) => s.unlock);
  const unlockWithBiometric = useAuth((s) => s.unlockWithBiometric);
  const resetAppAuth = useAuth((s) => s.resetAppAuth);
  const biometricEnabled = useAuth((s) => s.biometricEnabled);
  const failedAttempts = useAuth((s) => s.failedAttempts);
  const lockUntil = useAuth((s) => s.lockUntil);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(BOOT_NOW);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockUntil]);

  const remaining = remainingLockoutMs(lockUntil, now);
  const left = Math.max(0, MAX_ATTEMPTS - failedAttempts);

  const submit = async () => {
    if (busy || remaining > 0) return;
    setBusy(true);
    setError(null);
    const err = await unlock(pin);
    if (err) {
      setError(err);
      setPin('');
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const submitBio = async () => {
    if (busy || remaining > 0) return;
    setBusy(true);
    setError(null);
    const err = await unlockWithBiometric();
    setBusy(false);
    if (err) {
      setError(err);
    }
  };

  const askReset = () => setConfirmReset(true);

  return (
    <View style={Common.screen}>
      <AppHeader title="Terkunci" subtitle="Masukkan PIN untuk membuka PentungScore" />
      <View style={[Common.content, styles.body]}>
        <View style={styles.card}>
          <TextInput
            accessibilityLabel="PIN pembuka"
            value={pin}
            onChangeText={(v) => {
              setPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH));
              setError(null);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={remaining <= 0}
            style={styles.input}
          />
          {remaining > 0 ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Terkunci. Coba lagi dalam {Math.ceil(remaining / 1000)} detik.
            </Text>
          ) : (
            <Text style={styles.hint}>Sisa {left} percobaan sebelum dikunci sementara.</Text>
          )}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <AppButton
            label={busy ? 'Membuka...' : 'Buka'}
            onPress={submit}
            disabled={busy || remaining > 0 || pin.length !== PIN_LENGTH}
            disabledReason="Isi PIN 6 digit dulu atau tunggu timer kunci habis."
          />
          {biometricEnabled ? (
            <AppButton label="Gunakan Biometrik" variant="ghost" onPress={submitBio} />
          ) : null}
          <AppButton label="Lupa PIN? Reset kunci" variant="ghost" onPress={askReset} />
        </View>
      </View>
      <ConfirmSheet
        visible={confirmReset}
        title="Reset kunci?"
        message="PIN di perangkat ini akan dihapus dan kamu diminta buat PIN baru. Data permainan tetap ada."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await resetAppAuth();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontFamily: FontFamily.display,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
    paddingHorizontal: 12,
  },
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
});
