/** Store sesi pengguna: bootstrap / login / register / logout. */
import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, register as apiRegister, restoreSession } from './auth';
import { RemoteApiError } from './config';
import type { SessionUser } from './session';

interface SessionState {
  status: 'loading' | 'guest' | 'authenticated';
  user: SessionUser | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    try {
      const user = await restoreSession();
      set(user ? { status: 'authenticated', user } : { status: 'guest', user: null });
    } catch {
      set({ status: 'guest', user: null });
    }
  },

  login: async (email, password) => {
    try {
      const user = await apiLogin(email, password);
      set({ status: 'authenticated', user });
      return null;
    } catch (e) {
      return e instanceof RemoteApiError ? e.message : 'Gagal masuk. Coba lagi.';
    }
  },

  register: async (name, email, password) => {
    try {
      const user = await apiRegister(name, email, password);
      set({ status: 'authenticated', user });
      return null;
    } catch (e) {
      return e instanceof RemoteApiError ? e.message : 'Gagal mendaftar. Coba lagi.';
    }
  },

  logout: async () => {
    await apiLogout().catch(() => undefined);
    set({ status: 'guest', user: null });
  },
}));
