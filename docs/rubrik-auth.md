# Peta Penerapan Rubrik Autentikasi

> Status: terverifikasi — `tsc --noEmit` ✓ · `expo lint` ✓ · 112 test / 13 suite ✓
> Branch: `dika-fix/supabase-auth`

## Ringkasan

| Item rubrik | Bobot | File utama | Baris kunci |
|---|---|---|---|
| Secure Token Storage | 5% | `src/auth/sessionStorage.ts` | 23–92 |
| Supabase Auth Flow (Sign Up, Sign In, Sign Out, Loading States) | 10% | `src/auth/AuthContext.tsx` + `src/app/(public)/sign-in.tsx` | 135–158 / 36–81 |
| Global AuthContext & Real-time Session Subscription | 5% | `src/auth/AuthContext.tsx` | 96–174, 119–127 |
| Route Protection Guards | — | `src/app/_layout.tsx` | 90–126 |

---

## 1. Secure Token Storage (5%)

Pola resmi Supabase untuk Expo ("LargeSecureStore"): kunci AES-256 disimpan di
Keychain/Keystore (`expo-secure-store`), payload sesi dienkripsi AES-256-CTR lalu
disimpan di AsyncStorage — mengatasi batas 2048 byte per nilai di SecureStore.

| File | Baris | Fungsi | Fungsi apa |
|---|---|---|---|
| `src/auth/sessionStorage.ts` | 23–31 | `encrypt()` | Mengenkripsi sesi dengan AES-256-CTR (kunci acak 32 byte dari `expo-crypto`) |
| `src/auth/sessionStorage.ts` | 34–44 | `decrypt()` | Mendekripsi; `null` bila kunci/ciphertext tidak cocok (sesi dianggap kedaluwarsa) |
| `src/auth/sessionStorage.ts` | 46–66 | `getItemSafe()` | Baca ciphertext dari AsyncStorage + kunci dari SecureStore, lalu decrypt |
| `src/auth/sessionStorage.ts` | 68–72 | `setItemSafe()` | Kunci AES → SecureStore, ciphertext → AsyncStorage |
| `src/auth/sessionStorage.ts` | 74–85 | `removeItemSafe()` | Hapus ciphertext + kunci (dipanggil saat logout) |
| `src/auth/sessionStorage.ts` | 88–92 | `supabaseSessionStorage` | Adapter `storage` yang di-pass ke supabase-js (`getItem`/`setItem`/`removeItem`) |
| `src/auth/secureStorage.ts` | 8–18 | `getItem`/`setItem`/`deleteItem` | Wrapper `expo-secure-store` (Keychain/Keystore), opsi `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| `src/auth/supabase.ts` | 20–27 | `createClient(...)` | Konfigurasi `auth: { storage: supabaseSessionStorage, autoRefreshToken: true, persistSession: true }` |

**Cara kerja:** kunci enkripsi AES tidak pernah meninggalkan SecureStore, hanya
ciphertext yang disimpan di AsyncStorage. Sesi tetap aman meski penyimpanan
aplikasi tidak terenkripsi.

---

## 2. Supabase Auth Flow — Sign Up, Sign In, Sign Out, Loading States (10%)

### Logic — `src/auth/AuthContext.tsx`

| Baris | Fungsi | Fungsi apa |
|---|---|---|
| 135–139 | `signIn()` | `supabase.auth.signInWithPassword()` — login; error diterjemahkan ke Bahasa Indonesia |
| 141–150 | `signUp()` | `supabase.auth.signUp()` + `user_metadata.name`; return `true` bila butuh verifikasi email (tidak ada sesi) |
| 152–158 | `signOut()` | `supabase.auth.signOut({ scope: 'local' })` — sesi dihapus lebih dulu sehingga keluar tidak bergantung jaringan |
| 47–82 | `authErrorMessage()` | Penerjemah error Supabase → Bahasa Indonesia, berbasis `error.code` (termasuk mapping rate-limit spesifik) |

### UI — `src/app/(public)/sign-in.tsx`

| Baris | Bagian | Fungsi apa |
|---|---|---|
| 36–81 | `submit()` | Validasi form → panggil `signIn`/`signUp` → handle hasil & error |
| 59–61, 78–79 | `setBusy(true/false)` | State loading — tombol menampilkan spinner "Masuk…/Mendaftar…" |
| 220–231 | `<AppButton loading={busy} disabled={busy \|\| offline}>` | **Loading state** + disable tombol saat proses/offline |
| 63–66 | login branch | Sesi terbentuk → guard root layout otomatis mengalihkan ke `/(tabs)` |
| 67–75 | register branch | Jika butuh verifikasi → tampil notice "Email verifikasi sudah dikirim. Buka tautannya, lalu masuk." |
| 28–34 | state `mode/error/notice` | Toggle tab **Masuk/Daftar** (baris 128–151), banner error/sukses (baris 125–126) |
| 118–124 | banner offline | Peringatan bila perangkat sedang offline (submit dicegah, baris 37) |

---

## 3. Global AuthContext & Real-time Session Subscription (5%)

Semua di `src/auth/AuthContext.tsx`:

| Baris | Fungsi/Bagian | Fungsi apa |
|---|---|---|
| 96–174 | `AuthProvider()` | Context provider global — satu sumber kebenaran sesi untuk seluruh aplikasi |
| 102–117 | `useEffect` boot | `supabase.auth.getSession()` — baca sesi tersimpan sekali saat startup agar gate tidak berputar tanpa henti |
| **119–127** | **`supabase.auth.onAuthStateChange()`** | **Langganan real-time** — setiap perubahan sesi (login, logout, refresh token, kedaluwarsa) langsung update `session` & `status` di semua layar |
| 129–132 | cleanup | `subscription.unsubscribe()` saat komponen unmount |
| 160–173 | `useMemo` value | Menyediakan `{ configured, status, session, user, signIn, signUp, signOut }` |
| 177–181 | `useAuthSession()` | Hook konsumsi global; melempar error bila dipakai di luar `AuthProvider` |

**Pemasangan global:** `src/app/_layout.tsx` baris 41–47 — `RootLayout()`
membungkus seluruh aplikasi dengan `<AuthProvider>`.

---

## 4. Route Protection Guards

Semua di `src/app/_layout.tsx`, fungsi `RootNavigator()`:

| Baris | Bagian | Fungsi apa |
|---|---|---|
| 71–72 | `useAuthSession()` + `sessionLoading` | Baca `status` sesi Supabase; tahan render selama `loading` |
| 90–126 | `useEffect` guard utama | Menjalankan dua lapis redirect berdasarkan route aktif (`useSegments`) |
| **94–105** | **Lapis 1 — sesi Supabase** | `signedOut` + bukan di `(public)` → `router.replace('/sign-in')`; sudah `signedIn` tapi masih di `(public)` → `router.replace('/(tabs)')` — **wajib login untuk seluruh aplikasi** (dilewati bila env Supabase belum dikonfigurasi) |
| **107–114** | **Lapis 2 — kunci PIN perangkat** | Tanpa PIN → `/setup`; terkunci → `/unlock`; PIN valid → keluar dari `(auth)` |
| 134–144 | loading gate | Spinner global selama sesi masih `loading` (mencegah bocor konten terproteksi) |
| 128–132 | splash gate | Sembunyikan splash screen hanya setelah guard siap |

**Alur konsumen guard:**

- `src/app/(public)/sign-in.tsx` baris 64 & 74 — sesi terbentuk → effect guard (baris 90) otomatis mengalihkan.
- `src/app/(tabs)/account.tsx` baris 63–76 — `signOut()` → effect guard mengalihkan ke `/sign-in`.

---

## Peta file

```
Secure Token Storage ....... src/auth/sessionStorage.ts (23-92)
                            src/auth/secureStorage.ts (8-18)
                            src/auth/supabase.ts (20-27)

Auth Flow .................. src/auth/AuthContext.tsx (135-158, 47-82)
                            src/app/(public)/sign-in.tsx (36-81, 220-231)

AuthContext + Subscription .. src/auth/AuthContext.tsx (96-174, 119-127)
                            src/app/_layout.tsx (41-47)  ← pemasangan

Route Guards ............... src/app/_layout.tsx (90-126, khusus 94-105 & 107-114)
```

## Prasyarat penggunaan (di luar kode)

1. Jalankan `backend/supabase/004_supabase_auth.sql` di SQL Editor Supabase.
2. Matikan **Confirm email** (Authentication → Sign In / Providers → bagian *User Signups*).
3. Deploy backend ke Vercel (tanpa env baru).
