/**
 * TASK 03 — Session management dengan Zustand (konsisten dengan useAuth/useStore).
 *
 * - restore(): dipanggil sekali saat app start untuk cek "sudah login?"
 * - login()/logout(): update state + navigasi dilakukan di screen via router.
 * - Guard 401 terpusat sudah ditangani apiFetch (token basi auto-dihapus).
 */
import { create } from 'zustand';
import { router } from 'expo-router';
import { fetchPrograms, login as apiLogin, logout as apiLogout } from './authApi';
import { getToken } from './tokenStorage';
import type { Program } from './config';

interface SessionState {
  token: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  programs: Program[];
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  loadPrograms: () => Promise<string | null>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  initialized: false,
  loading: false,
  error: null,
  programs: [],

  restore: async () => {
    const token = await getToken().catch(() => null);
    set({ token, initialized: true });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const token = await apiLogin(email, password);
      set({ token, loading: false });
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login gagal.';
      set({ loading: false, error: message });
      return message;
    }
  },

  loadPrograms: async () => {
    set({ loading: true, error: null });
    try {
      const programs = await fetchPrograms();
      set({ programs, loading: false });
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat programs.';
      set({ loading: false, error: message });
      // TASK 03.2/03.3 — token invalid → apiFetch sudah hapus token,
      // arahkan user kembali ke login.
      if (e instanceof Error && e.name === 'ApiError' && (e as { status?: number }).status === 401) {
        set({ token: null, programs: [] });
        router.replace('/login' as never);
      }
      return message;
    }
  },

  logout: async () => {
    await apiLogout().catch(() => undefined);
    set({ token: null, programs: [], error: null });
    // TASK 03.2 — setelah logout, paksa kembali ke halaman login.
    router.replace('/login' as never);
  },
}));
