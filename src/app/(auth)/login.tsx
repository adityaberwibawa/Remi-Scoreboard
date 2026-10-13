import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../api/authMock';
import { useMock } from '../../api/config';
import { useSession } from '../../api/useSession';
import { Colors, Common, FontFamily, Radius } from '../../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);
  const register = useSession((s) => s.register);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showDemo = useMock();

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const err =
        mode === 'login' ? await login(email, password) : await register(name, email, password);
      if (err) {
        setError(err);
      } else {
        router.replace('/(tabs)');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[Common.screen, { paddingTop: insets.top + 24 }]}>
      <View style={[Common.content, styles.wrap]}>
        <Text accessibilityRole="header" style={styles.title}>
          {mode === 'login' ? 'Masuk' : 'Daftar Akun'}
        </Text>
        <Text style={styles.sub}>
          {mode === 'login'
            ? 'Masuk untuk sinkron papan peringkat server.'
            : 'Buat akun untuk sinkron papan peringkat server.'}
        </Text>

        {mode === 'register' ? (
          <TextInput
            accessibilityLabel="Nama"
            placeholder="Nama"
            placeholderTextColor={Colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!busy}
            style={styles.input}
          />
        ) : null}
        <TextInput
          accessibilityLabel="Email"
          placeholder="Email"
          placeholderTextColor={Colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!busy}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Kata sandi"
          placeholder={mode === 'login' ? 'Kata sandi' : 'Kata sandi (min. 8 karakter)'}
          placeholderTextColor={Colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!busy}
          style={styles.input}
        />

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {busy ? (
          <ActivityIndicator size="large" color={Colors.accent} accessibilityLabel="Memproses" />
        ) : (
          <AppButton
            label={mode === 'login' ? 'Masuk' : 'Daftar'}
            onPress={submit}
            hint={mode === 'login' ? 'Masuk ke akun' : 'Buat akun baru'}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          disabled={busy}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          style={styles.switch}>
          <Text style={styles.switchText}>
            {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </Text>
        </Pressable>

        {showDemo ? (
          <View style={styles.demo}>
            <Text style={styles.demoText}>Demo (tanpa backend):</Text>
            <Text style={styles.demoText}>
              {DEMO_EMAIL} / {DEMO_PASSWORD}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12, justifyContent: 'center', paddingBottom: 32 },
  title: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 24 },
  sub: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 14, marginBottom: 4 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontFamily: FontFamily.body,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: { color: Colors.danger, fontFamily: FontFamily.body, fontSize: 13 },
  switch: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  switchText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 14 },
  demo: {
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    gap: 2,
    marginTop: 8,
  },
  demoText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
});
