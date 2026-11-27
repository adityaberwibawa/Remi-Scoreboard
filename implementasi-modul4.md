# Implementasi Modul 4 — Autentikasi & Sesi

Pemetaan empat poin Modul 4 pada **PentungScore**.

| | |
| --- | --- |
| Repo | `adityaberwibawa/Remi-Scoreboard` |
| Branch | `master` @ `b7e47ef` (PR #7 — migrasi Supabase Auth) |
| Library | `@supabase/supabase-js ^2.119.2` — `package.json:10` |
| Verifikasi | `tsc --noEmit` ✔ · `expo lint` ✔ · Jest **13 suite / 108 test** ✔ · `expo export --platform web` ✔ |

---

## Ringkasan status

| # | Poin Modul 4 | Status | Berkas utama |
| --- | --- | :---: | --- |
| 1 | Secure Token Storage | ✅ | `src/auth/sessionStorage.ts`, `src/auth/secureStorage.ts` |
| 2 | Supabase Auth Flow (sign up / sign in / sign out + loading) | ✅ | `src/auth/AuthContext.tsx`, `src/app/(public)/sign-in.tsx` |
| 3 | Global AuthContext + real-time session subscription | ✅ | `src/auth/AuthContext.tsx:99–104` |
| 4 | Route protection guards | ✅ | `src/app/_layout.tsx:95–119`, `backend/lib/auth.js:44–48` |

---

## 1. Secure Token Storage

Sesi Supabase disimpan dua lapis. `expo-secure-store` dibatasi **2048 byte** per nilai, sedangkan access + refresh token Supabase bisa lebih besar, jadi yang masuk SecureStore hanya kunci enkripsinya.

| Lokasi | Peran |
| --- | --- |
| `src/auth/sessionStorage.ts:23–31` | `encrypt()` — AES-256-CTR, kunci acak 32 byte dari `expo-crypto` |
| `src/auth/sessionStorage.ts:68–72` | `setItemSafe()` — kunci → SecureStore, ciphertext → AsyncStorage |
| `src/auth/sessionStorage.ts:46–66` | `getItemSafe()` — dekripsi; kunci hilang/rusak → sesi dianggap habis |
| `src/auth/sessionStorage.ts:74–85` | `removeItemSafe()` — hapus ciphertext **dan** kunci saat logout |
| `src/auth/sessionStorage.ts:87–92` | Adapter `storage` yang dipasang ke supabase-js |
| `src/auth/secureStorage.ts:4–6` | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — tidak ikut backup/iCloud |
| `src/auth/supabase.ts:19–28` | `auth.storage` + `autoRefreshToken` + `persistSession` |
| `app.json:67–71` | Plugin `expo-secure-store` (`configureAndroidBackup`) |

**PIN perangkat** (terpisah dari akun): yang disimpan hanya hash SHA-256 + salt, tidak pernah PIN mentah — `src/auth/cryptoPin.ts:11,16,20`, dipakai di `src/auth/useAuth.ts:82–84` dan diverifikasi di `:102`.

**Batasan web:** `src/auth/secureStorage.web.ts:1–5` menyatakan bahwa fallback web memakai `localStorage` tanpa enkripsi (`:8–21`). Karena kunci AES juga disimpan di sana, enkripsi dua lapis hanya menambah keamanan di native (Keychain/Keystore); di web perlindungannya setara `localStorage` biasa.

---

## 2. Alur Sign Up / Sign In / Sign Out + Loading State

Client dibuat sekali dengan env build-time; tanpa env, fitur akun nonaktif dan aplikasi tetap berjalan mode lokal — `src/auth/supabase.ts:13–17`.

| Lokasi | Peran |
| --- | --- |
| `src/auth/AuthContext.tsx:112–116` | `signIn` → `supabase.auth.signInWithPassword()` |
| `src/auth/AuthContext.tsx:118–127` | `signUp` → `supabase.auth.signUp({ options: { data: { name } } })`; mengembalikan `true` bila butuh verifikasi email |
| `src/auth/AuthContext.tsx:129–135` | `signOut` → `signOut({ scope: 'local' })`, tetap berhasil saat offline |
| `src/auth/supabase.ts:31–35` | `getAccessToken()` → `getSession()` untuk request ke backend |
| `src/auth/AuthContext.tsx:38–59` | `authErrorMessage()` — pesan Supabase diterjemahkan ke Bahasa Indonesia |
| `src/app/(public)/_layout.tsx:1–9` | Route group `(public)` berisi layar masuk |
| `src/app/(public)/sign-in.tsx:36–81` | `submit()` — satu handler untuk mode masuk & daftar |
| `src/app/(public)/sign-in.tsx:41–57` | Validasi: format email, nama 2–80 karakter, sandi 8–128 karakter |
| `src/app/(public)/sign-in.tsx:59–80` | State `busy` / `error` / `notice`, termasuk pesan "Email verifikasi sudah dikirim" |
| `src/app/(public)/sign-in.tsx:220–231` | Tombol `AppButton` dengan `loading` + `disabled` saat offline |
| `src/app/(public)/sign-in.tsx:83–106` | Fallback "Fitur akun belum aktif" bila env Supabase kosong |

Alur daftar: validasi lokal → `signUp()` → bila `session` langsung ada, guard root memindahkan ke `/(tabs)`; bila perlu verifikasi, pengguna kembali ke mode masuk dan menunggu klik tautan email.

---

## 3. Global AuthContext + Real-time Session Subscription

Satu provider di root; semua layar membaca sesi yang sama.

| Lokasi | Peran |
| --- | --- |
| `src/auth/AuthContext.tsx:73–151` | `AuthProvider` — state `session` + `status` (`loading`/`signedOut`/`signedIn`) |
| `src/auth/AuthContext.tsx:85–94` | Boot: `getSession()` dibaca sekali agar gate tidak berputar |
| `src/auth/AuthContext.tsx:97–104` | `supabase.auth.onAuthStateChange()` — login, logout, refresh token, kedaluwarsa |
| `src/auth/AuthContext.tsx:106–109` | Cleanup: `subscription.unsubscribe()` saat unmount |
| `src/auth/AuthContext.tsx:154–158` | `useAuthSession()` — gagal keras bila dipakai di luar provider |
| `src/app/_layout.tsx:44–46` | Provider dipasang membungkus seluruh navigasi |
| `src/app/_layout.tsx:72–73` | Root membaca `status` untuk guard |
| `src/app/(tabs)/account.tsx:48,61` | Tab Akun membaca `user` + `status` |

`getSession()` dan `onAuthStateChange()` saling menjaga lewat flag `eventSeen` (`:82`, `:88`, `:101`): hasil boot tidak boleh menimpa event yang lebih baru.

---

## 4. Route Protection Guards

Guard berlapis dua, berurutan: **sesi akun** dulu, baru **PIN perangkat**. Guard menunggu sesi selesai dimuat (`sessionLoading`) supaya tidak salah arah saat boot.

```ts
// src/app/_layout.tsx:101–119
if (configured) {
  if (sessionStatus === 'signedOut') {
    if (group !== '(public)') router.replace('/sign-in');   // belum masuk
    return;
  }
  if (group === '(public)') router.replace('/(tabs)');       // sudah masuk
}

if (!hasPin) {
  if (screen !== 'setup') router.replace('/(auth)/setup');   // PIN belum diset
} else if (locked) {
  if (screen !== 'unlock') router.replace('/(auth)/unlock'); // terkunci
} else if (group === '(auth)') {
  router.replace('/(tabs)');
}
```

| Lokasi | Peran |
| --- | --- |
| `src/app/_layout.tsx:95–119` | Efek guard utama |
| `src/app/_layout.tsx:96` | Tahan redirect selama sesi masih `loading` |
| `src/app/_layout.tsx:139` | Spinner penuh selama sesi belum pasti |
| `src/app/_layout.tsx:184` | `Stack.Screen name="(public)"` terdaftar |
| `backend/lib/auth.js:25–41` | `verifySupabaseUser()` — validasi token ke `GET /auth/v1/user` memakai secret key |
| `backend/lib/auth.js:44–48` | `bearerUser()` — ambil token dari header `Authorization` |
| `backend/api/me.js:8` | `/api/me` menolak request tanpa sesi valid |
| `backend/api/sync.js:11` | `/api/sync` juga memakai `bearerUser()` |
| `src/auth/accountApi.ts:59–79` | Klien mengirim Bearer; bila token kedaluwarsa, ambil token hasil auto-refresh sekali |
| `backend/supabase/004_supabase_auth.sql:17–21` | RLS `user_snapshots` aktif; akses hanya `service_role`, bukan `anon`/`authenticated` |

---

## Verifikasi

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # expo lint
bun run test        # 13 suite / 108 test
bunx expo export --platform web
```

Test khusus autentikasi:

| Berkas | Cakupan |
| --- | --- |
| `src/auth/__tests__/sessionStorage.test.ts` | Token tersimpan sebagai ciphertext, kunci terpisah, ciphertext rusak → sesi gugur |
| `src/auth/__tests__/authContext.test.ts` | Terjemahan error Supabase, `getDisplayName` |
| `src/auth/__tests__/accountApi.test.ts` | Bearer token dari sesi Supabase, retry setelah token diperbarui |

---

## Catatan penerapan

1. **Env wajib** — `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env` lokal, sudah terisi di `eas.json:15–16,26–27`). Tanpa itu tab Akun menampilkan "Fitur akun belum aktif".
2. **Backend** — butuh `SUPABASE_URL` + `SUPABASE_SECRET_KEY` di Vercel; keduanya server-side, tidak pernah dikirim ke aplikasi.
3. **SQL** — `backend/supabase/004_supabase_auth.sql` memindahkan `user_snapshots.user_id` ke `auth.users(id)` dan menghapus tabel auth kustom (`account_users`, `refresh_tokens`). Data akun & cadangan lama tidak dimigrasikan — keputusan yang disepakati.
4. **Konfirmasi email** — proyek Supabase saat ini mengaktifkan *Confirm email*, sehingga pendaftar baru harus memverifikasi email sebelum masuk. Mematikan opsi itu di dashboard membuat pendaftaran langsung masuk.
