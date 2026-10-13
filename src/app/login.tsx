/**
 * TASK 01 — Screen Login: input email & password, loading state, pesan error.
 * Route top-level `/login` (bukan di grup (auth)) agar tidak bertabrakan
 * dengan gerbang PIN di _layout. Kredensial demo mock: demo@remi.id / remi123.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius } from '../theme';
import { useApiAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, loading, error, token } = useApiAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (loading) return;
    const err = await login(email, password);
    if (!err) router.replace('/(tabs)/scores');
  };

  return (
    <View style={Common.screen}>
      <AppHeader title="Masuk Remi" subtitle="Login untuk mengakses skor tersimpan" />
      <View style={[Common.content, styles.body]}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="demo@remi.id"
            placeholderTextColor={Colors.muted}
            returnKeyType="next"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={Colors.muted}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <AppButton
            label={loading ? 'Masuk...' : 'Login'}
            onPress={submit}
            disabled={loading || !email.trim() || !password}
            disabledReason="Isi email dan password dulu."
            hint="Kirim POST /login"
          />
          <Text style={styles.hint}>Demo mock: demo@remi.id / remi123{token ? ' • sesi aktif' : ''}</Text>
        </View>
      </View>
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
  label: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
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
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
});
