# PentungScore API

Vercel Functions API untuk akun PentungScore. Backend ini memakai Supabase Postgres melalui REST API dan Node.js built-in crypto; tidak memerlukan dependency runtime tambahan.

## Endpoint

| Method | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Membuat akun dan mengembalikan token |
| `POST` | `/api/auth/login` | Login email/kata sandi |
| `POST` | `/api/auth/refresh` | Rotasi refresh token |
| `POST` | `/api/auth/logout` | Mencabut refresh token |
| `GET` | `/api/me` | Memeriksa access token dan mengambil profil |
| `GET` | `/api/templates` | Daftar template sesi (publik, tanpa token) |
| `GET` | `/api/sync` | Ambil cadangan pemain & sesi milik akun |
| `PUT` | `/api/sync` | Simpan cadangan (snapshot terakhir menang) |

Endpoint auth (`register`, `login`, `refresh`) dilindungi rate limit in-memory per IP (best-effort per instance Vercel): 5 pendaftaran / 10 menit, 10 login / 10 menit, 30 refresh / 10 menit. Untuk beban publik, ganti dengan limiter terdistribusi (mis. Redis/Upstash).

Access token berlaku 15 menit. Refresh token berlaku 30 hari dan disimpan dalam bentuk hash di database. Kata sandi di-hash dengan scrypt.

Klien mobile tersedia di `src/auth/accountApi.ts` dan dipakai oleh tab **Akun**. Base URL diambil dari env build-time `EXPO_PUBLIC_API_URL` (mis. `https://remi-scoreboard-backend.vercel.app`). Contoh pemakaian:

```ts
const accountApi = new AccountApi('https://<deployment>.vercel.app');
await accountApi.login(email, password);
const profile = await accountApi.currentUser();
const snapshot = await accountApi.pullSnapshot();
await accountApi.pushSnapshot(players, sessions);
await accountApi.logout();
```

Tab Akun memungkinkan login/daftar, mencadangkan snapshot pemain & sesi, memulihkannya dengan konfirmasi, dan keluar. PIN/biometrik tetap mengunci aplikasi secara lokal dan tidak dikirim ke server.

## Supabase

1. Buat proyek Supabase.
2. Buka **SQL Editor**, jalankan berurutan:
   - `supabase/schema.sql` (akun + refresh token),
   - `supabase/templates.sql` (template sesi + seed),
   - `supabase/002_template_rules.sql` (jika tabel template sudah ada sebelum upgrade kolom aturan),
   - `supabase/003_user_snapshots.sql` (cadangan cloud per akun).
3. Dari **Project Settings > API Keys**, salin Project URL dan secret key (`sb_secret_...`). Jangan pernah menaruh secret key di aplikasi Expo. Backend juga masih menerima nama variabel lama `SUPABASE_SERVICE_ROLE_KEY` untuk transisi.

## Deploy ke Vercel

1. Import repo ini ke Vercel.
2. Set **Root Directory** ke `backend`.
3. Tambahkan environment variables untuk Production (dan Preview bila diperlukan):
   - `SUPABASE_URL` — URL proyek Supabase.
   - `SUPABASE_SECRET_KEY` — secret server-side (`sb_secret_...`) dari Supabase.
   - `TOKEN_SECRET` — secret acak minimal 32 karakter, misalnya hasil `openssl rand -base64 48`.
4. Deploy. Endpoint akan berada di `https://<deployment>.vercel.app/api/...`.

## Uji manual

```sh
curl -X POST https://<deployment>.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi","email":"budi@example.com","password":"rahasia123"}'
```

## Catatan

- Paket Vercel Hobby hanya untuk proyek pribadi/nonkomersial; lihat ketentuan paket Vercel sebelum penggunaan publik/komersial.
- Proyek ini belum membatasi percobaan login per alamat IP. Tambahkan rate limiting sebelum membuka registrasi untuk publik.
- Fungsi `/api/me` memvalidasi access token. Endpoint data pemain dan sesi belum dibuat; tambahkan setelah database dan alur akun siap.
