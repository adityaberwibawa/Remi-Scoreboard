/**
 * Klien Supabase untuk aplikasi (Supabase Auth).
 *
 * Sesi di-persist ke penyimpanan aman (lihat sessionStorage.ts) dengan auto-refresh
 * token. `detectSessionInUrl` dimatikan karena React Native tidak punya alur redirect
 * browser. Tanpa env build, klien bernilai null dan fitur akun nonaktif — aplikasi
 * tetap bisa dipakai (mode lokal).
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseSessionStorage } from './sessionStorage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '') ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** false bila env build belum diisi → tab akun menampilkan "fitur belum aktif". */
export const supabaseConfigured = /^https:\/\/\S+$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: supabaseSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Access token sesi berjalan untuk request backend (null bila belum masuk). */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
