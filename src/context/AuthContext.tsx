/**
 * TASK 03 — AuthContext (React Context API) untuk session API Week 5.
 *
 * Beda dari `src/auth/useAuth.ts` (Zustand, PIN lokal): context ini khusus
 * token API + user. Nama hook `useApiAuth` agar tidak bentrok dengan `useAuth` PIN.
 *
 * - restore(): baca token dari SecureStore saat app dibuka (session persisten).
 * - login(): POST /login → simpan token → set user.
 * - logout(): hapus token → kembali ke /login.
 * - 401 dari apiFetch otomatis menghapus token (lihat client.ts).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import type { ApiUser } from '../api/config';
import { loginRemi, logout as apiLogout } from '../api/authApi';
import { getToken } from '../api/tokenStorage';
import { MOCK_USER } from '../api/mock';
import { USE_MOCK_API } from '../api/config';

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  loading: boolean;
  restoring: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TASK 03.3 — cek session saat app dibuka. Token ada → session aktif.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getToken().catch(() => null);
      if (cancelled) return;
      if (saved) {
        setToken(saved);
        // Mock belum punya /me → pakai user demo. Saat API asli ada,
        // ganti dengan GET /me di sini.
        setUser(USE_MOCK_API ? MOCK_USER : null);
      }
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginRemi(email, password);
      setToken(result.token);
      setUser(result.user);
      setLoading(false);
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login gagal.';
      setLoading(false);
      setError(message);
      return message;
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => undefined);
    setToken(null);
    setUser(null);
    setError(null);
    // TASK 03.2 — setelah logout kembali ke halaman Login.
    router.replace('/login');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, restoring, error, login, logout, clearError }),
    [user, token, loading, restoring, error, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook untuk mengakses session API. Harus dipakai di dalam <AuthProvider>. */
export function useApiAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useApiAuth harus dipakai di dalam <AuthProvider>.');
  return ctx;
}
