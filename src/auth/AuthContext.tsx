/**
 * AuthContext global: satu sumber kebenaran untuk sesi Supabase di seluruh aplikasi.
 *
 * - Boot: baca sesi tersimpan (SecureStore) sekali lalu berlangganan
 *   `supabase.auth.onAuthStateChange` — setiap perubahan sesi (login, logout,
 *   refresh token, kedaluwarsa) langsung ter-reflect ke semua layar.
 * - Layar route guard membaca `status`; tab Akun membaca `user`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  /** false → env build belum diisi; fitur akun nonaktif dan guard dilewati. */
  configured: boolean;
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** true = akun dibuat tapi butuh konfirmasi email (tidak ada sesi). */
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Baca `error.code` bawaan AuthError Supabase (lebih akurat daripada cocok string). */
function readAuthCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return null;
}

/** Pesan error Supabase → Bahasa Indonesia, mengikuti gaya `src/api/errors.ts`. */
export function authErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  const code = readAuthCode(error);

  // Prioritas ke error code resmi Supabase (lihat @supabase/auth-js error-codes).
  // Satu kode bisa mewakili dua limit berbeda — hanya pesan yang membedakan.
  if (code === 'over_email_send_rate_limit') {
    return message.includes('for security purposes') || message.includes('after')
      ? 'Permintaan terlalu sering untuk email yang sama. Tunggu sekitar satu menit lalu coba lagi.'
      : 'Terlalu banyak permintaan dari perangkat ini. Tunggu sekitar satu jam lalu coba lagi.';
  }
  if (code === 'over_request_rate_limit') {
    return 'Server sedang membatasi permintaan. Coba lagi beberapa menit lagi.';
  }

  if (message.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Email sudah terdaftar. Silakan masuk.';
  }
  if (message.includes('email not confirmed')) {
    return 'Email belum diverifikasi. Buka tautan di kotak masuk email kamu.';
  }
  if (message.includes('password should be at least')) return 'Kata sandi minimal 6 karakter.';
  // Fallback untuk error tanpa code (mis. respons gateway non-standar).
  if (message.includes('rate limit') || message.includes('too many request')) {
    return 'Terlalu banyak percobaan. Coba lagi sebentar lagi.';
  }
  if (message.includes('signup is disabled')) return 'Pendaftaran akun sedang dinonaktifkan.';
  if (message.includes('failed to fetch') || message.includes('network request failed')) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet.';
  }
  if (message.includes('apikey') || message.includes('invalid url')) {
    return 'Konfigurasi akun aplikasi belum benar. Hubungi pengembang.';
  }
  return message.trim().length > 0 && message.length <= 160 ? errorText(error) : fallback;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Nama tampilan akun Supabase (user_metadata.name, fallback email). */
export function getDisplayName(user: User | null): string {
  const metadata = user?.user_metadata as { name?: unknown } | undefined;
  const name = typeof metadata?.name === 'string' ? metadata.name.trim() : '';
  if (name) return name;
  return user?.email ?? 'Akun';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    supabaseConfigured ? 'loading' : 'signedOut',
  );

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let eventSeen = false;

    // Boot: sesi tersimpan dibaca sekali agar gate tidak berputar tanpa henti.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive || eventSeen) return;
        setSession(data.session);
        setStatus(data.session ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (alive && !eventSeen) setStatus('signedOut');
      });

    // Langganan sesi real-time: login, logout, refresh, dan kedaluwarsa token.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      eventSeen = true;
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Fitur akun belum aktif.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(authErrorMessage(error));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) throw new Error('Fitur akun belum aktif.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(authErrorMessage(error));
    return data.session === null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // scope 'local': sesi dihapus lebih dulu sehingga keluar tidak bergantung jaringan,
    // sambil tetap mencoba mencabut refresh token di server.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error(authErrorMessage(error, 'Gagal keluar. Coba lagi.'));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: supabaseConfigured,
      status,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [status, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Akses sesi global; melempar bila dipakai di luar `AuthProvider`. */
export function useAuthSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthSession harus dipakai di dalam AuthProvider.');
  return context;
}
