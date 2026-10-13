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

Access token berlaku 15 menit. Refresh token berlaku 30 hari dan disimpan dalam bentuk hash di database. Kata sandi di-hash dengan scrypt.

Klien mobile dasar sudah tersedia di `src/auth/accountApi.ts`; ia menyimpan token dengan SecureStore dan bisa dipakai seperti ini setelah URL Vercel tersedia:

```ts
const accountApi = new AccountApi('https://<deployment>.vercel.app');
await accountApi.login(email, password);
const profile = await accountApi.me();
await accountApi.logout();
```

Layar akun belum ditambahkan ke navigasi. PIN/biometrik yang sudah ada tetap mengunci aplikasi secara lokal.

## Supabase

1. Buat proyek Supabase.
2. Buka **SQL Editor**, jalankan `supabase/schema.sql`.
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
