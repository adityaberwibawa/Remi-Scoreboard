# PentungScore API

Vercel Functions API untuk cadangan cloud PentungScore. Backend ini memakai Supabase Postgres melalui REST API dan Node.js built-in crypto; tidak memerlukan dependency runtime tambahan.

Autentikasi dikelola oleh **Supabase Auth** di sisi aplikasi (sign up / sign in / sign out lewat `@supabase/supabase-js`). Backend hanya memvalidasi `access token` yang dikirim aplikasi.

## Endpoint

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/me` | Memvalidasi access token Supabase dan mengambil profil |
| `GET` | `/api/templates` | Daftar template sesi (publik, tanpa token) |
| `GET` | `/api/sync` | Ambil cadangan pemain & sesi milik akun |
| `PUT` | `/api/sync` | Simpan cadangan (snapshot terakhir menang) |

Endpoint lama `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, dan `/api/auth/logout` **dihapus** — akun dibuat dan sesi dikelola oleh Supabase Auth.

## Validasi token

`bearerUser()` di `lib/auth.js` memverifikasi `Authorization: Bearer <access token>` dengan memanggil `GET {SUPABASE_URL}/auth/v1/user` memakai `SUPABASE_SECRET_KEY` (server-side, tidak pernah dibagikan ke klien). Pendekatan ini berlaku untuk signing key asimetris (PS256/EdDSA) maupun JWT lama HS256, tanpa dependensi tambahan, dan selalu mengikuti status terbaru token di Supabase.

## Klien mobile

Klien cadangan cloud ada di `src/auth/accountApi.ts` (pakai access token dari sesi Supabase) dan tab **Akun** memakainya untuk Cadangkan / Pulihkan. Auth itu sendiri ada di `src/auth/AuthContext.tsx` + `src/auth/supabase.ts`. Base URL backend diambil dari env build-time `EXPO_PUBLIC_API_URL`; konfigurasi Supabase dari `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

```ts
const api = new AccountApi('https://<deployment>.vercel.app');
const snapshot = await api.pullSnapshot();
await api.pushSnapshot(players, sessions);
```

Layar masuk/daftar ada di `src/app/(public)/sign-in.tsx` dan route guard di `src/app/_layout.tsx` mewajibkan sesi Supabase untuk seluruh aplikasi. PIN/biometrik tetap mengunci aplikasi secara lokal dan tidak dikirim ke server.

## Supabase

1. Buat proyek Supabase.
2. Buka **SQL Editor**, jalankan berurutan:
   - `supabase/schema.sql` (tabel akun lama — hanya untuk instalasi baru yang masih pakai versi lama; dapat dilewati),
   - `supabase/templates.sql` (template sesi + seed),
   - `supabase/002_template_rules.sql` (jika tabel template sudah ada sebelum upgrade kolom aturan),
   - `supabase/003_user_snapshots.sql` (cadangan cloud per akun),
   - `supabase/004_supabase_auth.sql` (migrasi ke Supabase Auth: ganti FK `user_snapshots` ke `auth.users` dan hapus tabel akun custom).
3. Dari **Project Settings > API Keys**, salin Project URL, publishable key (`sb_publishable_...`), dan secret key (`sb_secret_...`). Jangan pernah menaruh secret key di aplikasi Expo. Backend juga masih menerima nama variabel lama `SUPABASE_SERVICE_ROLE_KEY` untuk transisi.
4. **Authentication → Sign In / Providers → Email**: matikan *Confirm email* bila tidak memerlukan verifikasi inbox (aplikasi tetap menangani kasus verifikasi aktif).

## Deploy ke Vercel

1. Import repo ini ke Vercel.
2. Set **Root Directory** ke `backend`.
3. Tambahkan environment variables untuk Production (dan Preview bila diperlukan):
   - `SUPABASE_URL` — URL proyek Supabase.
   - `SUPABASE_SECRET_KEY` — secret server-side (`sb_secret_...`) dari Supabase.
4. Deploy. Endpoint akan berada di `https://<deployment>.vercel.app/api/...`.

## Uji manual

```sh
# 1. Ambil access token dari aplikasi (sesi Supabase), lalu:
curl https://<deployment>.vercel.app/api/me \
  -H "Authorization: Bearer <access token>"
```

## Catatan

- Paket Vercel Hobby hanya untuk proyek pribadi/nonkomersial; lihat ketentuan paket Vercel sebelum penggunaan publik/komersial.
- Rate limit endpoint auth tidak lagi diperlukan di backend karena pendaftaran/login diproses Supabase Auth (punya proteksi bawaan).
