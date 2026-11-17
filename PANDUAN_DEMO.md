# Panduan Demo — PentungScore

Dokumen ini memetakan **di mana** setiap kriteria tugas diimplementasikan, **cara menunjukkan**-nya saat demo, dan **apa yang harus dijelaskan**.

> Nomor baris di bawah ini berdasarkan kondisi kode saat dokumen dibuat. Kalau kode berubah, gunakan pencarian nama fungsi sebagai cadangan.

---

## 0. Peringatan sebelum demo

Endpoint production terakhir dicek merespons **500**:

```text
GET  /api/templates   → 500
POST /api/auth/login  → 500 (bukan 401)
```

Artinya backend tidak bisa mengakses Supabase. Kemungkinan besar project Supabase free tier **ter-pause** karena tidak ada aktivitas, atau environment variable di Vercel salah.

Perbaiki dulu:

1. Buka **Supabase Dashboard** → project → jika **Paused**, klik **Restore/Resume**.
2. Buka **Vercel Dashboard** → project backend → **Settings → Environment Variables**:
   - `SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `SUPABASE_SECRET_KEY` = `sb_secret_...`
   - `TOKEN_SECRET` = minimal 32 karakter
3. Buka **Vercel → Logs → Functions**, cari `Templates fetch failed` atau `Login failed`.
4. Setelah env diubah, **Redeploy**.
5. Verifikasi:

```powershell
curl.exe -sS -i https://remi-scoreboard-backend.vercel.app/api/templates
```

Harus `200 OK` dan mengembalikan array JSON.

---

## 1. Ringkasan kriteria

| Kriteria | Status | Lokasi utama |
|---|---|---|
| External API → object via `interface` | ✅ | `src/api/dto.ts:27,41,78`, `src/api/client.ts:108,125,133`, `src/api/http.ts:99`, `backend/lib/db.js:13` |
| Custom async function | ✅ | `src/api/client.ts:108`, `src/api/http.ts:78,152`, `src/auth/accountApi.ts:71–126` |
| Pre-built async function | ✅ | `src/api/http.ts:99,66`, `src/db.ts:25`, `src/store.ts:77` |
| `.then()` | ✅ | `src/api/useSessionTemplates.ts:72,83`, `src/db.ts:26`, `src/app/(tabs)/players.tsx:51` |
| `resolve` / `reject` | ✅ | `src/api/http.ts:37–44`, `src/api/client.ts:70–77` |
| `Promise.resolve()` / `Promise.reject()` | ✅ | `src/api/http.ts:35–36`, `src/api/client.ts:67,69` |

---

## 2. Alur data

```text
Supabase REST API (external)
        ↑ fetch()  backend/lib/db.js:13
Vercel API  GET /api/templates
        ↑ fetch()  src/api/http.ts:99
requestJson()  src/api/http.ts:152
        ↑
fetchSessionTemplates()  src/api/client.ts:108
        ↑ mapServerTemplateList()  src/api/dto.ts:99
SessionTemplate object (interface)  src/api/dto.ts:41
        ↑
TemplateSection / form create  src/components/TemplateSection.tsx:94
```

Dua lapis “external API”:

- Dari sisi aplikasi mobile: `https://remi-scoreboard-backend.vercel.app/api/templates` (REST API remote).
- Dari sisi backend: Supabase REST API (`https://<project>.supabase.co/rest/v1/...`).

Secret key Supabase hanya ada di server, tidak dikirim ke aplikasi mobile.

---

## 3. Kriteria 1 — External API → object via Interface

### 3.1 Interface bentuk mentah API

**`src/api/dto.ts:27`**

```ts
export interface ServerTemplateJson {
  id: number;
  name: string;
  description: string;
  image: string;
  status: string;
  min_players?: number;
  target_score_enabled?: boolean;
  target_score?: number;
  created_at?: string;
  updated_at?: string;
}
```

### 3.2 Interface object aplikasi

**`src/api/dto.ts:41`**

```ts
export interface SessionTemplate {
  id: number;
  title: string;
  description: string;
  image: string;
  status: TemplateStatus;
  minPlayers: number;
  targetScoreEnabled: boolean;
  targetScore: number;
}
```

Interface lain:

| File:Line | Interface | Fungsi |
|---|---|---|
| `src/auth/accountApi.ts:7` | `AccountUser` | Profil user dari API |
| `src/auth/accountApi.ts:13` | `AccountTokens` | Token login/register |
| `src/auth/accountApi.ts:22` | `AccountSnapshot` | Backup cloud |
| `src/sync/snapshot.ts:21` | `Snapshot` | Restore snapshot |
| `src/api/client.ts:37` | `FetchTemplatesResult` | Hasil fetch template |

### 3.3 Ambil data dari API

**`src/api/client.ts:108`** — fungsi utama:

```ts
export async function fetchSessionTemplates(
  options: FetchTemplatesOptions = {},
): Promise<FetchTemplatesResult> {
```

**`src/api/client.ts:125–129`** — memanggil endpoint:

```ts
const data = await requestJson<unknown>(
  `${baseUrl}/api/templates`,
  { method: 'GET', headers: { Accept: 'application/json' } },
  { signal },
);
```

**`src/api/http.ts:99`** — `fetch()` yang menembak jaringan:

```ts
response = await fetch(url, { ...init, signal: controller.signal });
```

**`backend/lib/db.js:13`** — backend memanggil Supabase (external API):

```js
const response = await fetch(`${url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
```

**`backend/api/templates.js:8`** — handler endpoint `/api/templates`:

```js
async fetch(request) {
```

**`backend/api/templates.js:15`** — query tabel template:

```js
rows = await db('session_templates', {
```

### 3.4 Mapping JSON → object

**`src/api/dto.ts:78`** — fungsi mapping:

```ts
export function mapServerTemplateToTemplate(
  item: ServerTemplateJson,
): SessionTemplate | null {
```

**`src/api/dto.ts:86–95`** — object literal yang dikembalikan:

```ts
return {
  id: item.id,
  title,
  description: typeof item.description === 'string' ? item.description : '',
  image: typeof item.image === 'string' ? item.image : '',
  status,
  minPlayers: toIntInRange(item.min_players, 2, 6, 2),
  targetScoreEnabled: item.target_score_enabled === true,
  targetScore: toIntInRange(item.target_score, 0, 100_000, 0),
};
```

Perubahan field:

| JSON API | Object aplikasi |
|---|---|
| `name` | `title` |
| `min_players` | `minPlayers` |
| `target_score_enabled` | `targetScoreEnabled` |
| `target_score` | `targetScore` |
| `created_at`, `updated_at` | dibuang |

**`src/api/dto.ts:99`** — mapping array:

```ts
export function mapServerTemplateList(data: unknown): SessionTemplate[] {
```

**`src/api/client.ts:133`** — hasil fetch diubah menjadi object:

```ts
const templates = mapServerTemplateList(data);
```

### 3.5 Bukti object dipakai sampai UI

**`src/components/TemplateSection.tsx:94`**

```tsx
{templates.map((t) => {
```

**`src/components/TemplateSection.tsx:97–98`** — memakai field hasil mapping:

```tsx
`${t.minPlayers} pemain min`,
t.targetScoreEnabled && t.targetScore > 0 ? `target ${t.targetScore}` : null,
```

**`src/components/TemplateSection.tsx:121`** — `t.title` berasal dari `name` API:

```tsx
{t.title}
```

**`src/app/(tabs)/index.tsx:84–87`** — object diteruskan ke form create:

```tsx
title: t.title,
minPlayers: String(t.minPlayers),
targetEnabled: t.targetScoreEnabled ? '1' : '0',
targetScore: String(t.targetScore > 0 ? t.targetScore : 500),
```

**Demo bonus:** klik template aktif → form create terbuka dengan aturan `minPlayers` dan `targetScore` terisi. Ini membuktikan data API benar-benar dipakai, bukan hardcode.

---

## 4. Kriteria 2 — Custom & Pre-built Async Function

### 4.1 Custom async function (dibuat sendiri)

| File:Line | Fungsi | Peran |
|---|---|---|
| `src/api/client.ts:84` | `readCachedTemplateList()` | Baca cache SQLite |
| `src/api/client.ts:96` | `saveTemplateCache()` | Simpan cache |
| `src/api/client.ts:108` | `fetchSessionTemplates()` | Ambil template dari API |
| `src/api/http.ts:63` | `readBody()` | Baca body response |
| `src/api/http.ts:78` | `requestOnce()` | Satu percobaan HTTP + timeout |
| `src/api/http.ts:152` | `requestJson()` | HTTP + retry/backoff |
| `src/auth/accountApi.ts:71` | `register()` | Daftar akun |
| `src/auth/accountApi.ts:80` | `login()` | Login akun |
| `src/auth/accountApi.ts:89` | `me()` | Ambil profil |
| `src/auth/accountApi.ts:112` | `pullSnapshot()` | Ambil backup |
| `src/auth/accountApi.ts:117` | `pushSnapshot()` | Simpan backup |
| `src/db.ts:115` | `fetchPlayers()` | Baca pemain dari SQLite |
| `src/db.ts:194` | `fetchSessions()` | Baca sesi |
| `src/store.ts:74` | `loadAll()` | Load semua data |

Contoh paling jelas — **`src/api/client.ts:108`**:

```ts
export async function fetchSessionTemplates(
  options: FetchTemplatesOptions = {},
): Promise<FetchTemplatesResult> {
```

### 4.2 Pre-built async function (bawaan platform/library)

| File:Line | Fungsi bawaan | Jenis |
|---|---|---|
| `src/api/http.ts:99` | `fetch()` | Web API |
| `src/api/http.ts:66` | `response.text()` | Web API |
| `backend/lib/db.js:13` | `fetch()` | Node/Web API |
| `backend/lib/db.js:27` | `response.text()` | Web API |
| `src/db.ts:25` | `SQLite.openDatabaseAsync()` | Expo SQLite |
| `src/store.ts:77` | `Promise.all()` | JavaScript |
| `src/auth/secureStorage.ts:9` | `SecureStore.getItemAsync()` | Expo SecureStore |
| `src/auth/secureStorage.ts:13` | `SecureStore.setItemAsync()` | Expo SecureStore |
| `src/auth/secureStorage.ts:17` | `SecureStore.deleteItemAsync()` | Expo SecureStore |
| `src/auth/cryptoPin.ts:12` | `Crypto.getRandomBytesAsync()` | Expo Crypto |
| `src/auth/cryptoPin.ts:17` | `Crypto.digestStringAsync()` | Expo Crypto |
| `src/auth/useAuth.ts:61–62` | `LocalAuthentication.hasHardwareAsync()` / `isEnrolledAsync()` | Expo LocalAuthentication |
| `src/photo.ts:16–17` | `ImagePicker.requestCameraPermissionsAsync()` | Expo ImagePicker |
| `src/photo.ts:32` | `FileSystem.getInfoAsync()` | Expo FileSystem |
| `src/app/_layout.tsx:27` | `SplashScreen.preventAutoHideAsync()` | Expo SplashScreen |

Contoh penggabungan custom + pre-built — **`src/api/http.ts:99`** di dalam `requestOnce()`:

```ts
response = await fetch(url, { ...init, signal: controller.signal });
```

### 4.3 Kalimat penjelasan

> “Custom async adalah fungsi yang saya tulis sendiri dan mengembalikan Promise. Pre-built async adalah fungsi bawaan Web API/Expo yang sudah Promise-based. Keduanya saya konsumsi dengan `await`, dan error-nya ditangkap `try/catch`.”

---

## 5. Kriteria 3 — `.then()`, `resolve`, `reject`

### 5.1 `.then()`

| File:Line | Kode | Konteks |
|---|---|---|
| `src/api/useSessionTemplates.ts:72` | `.then((cached) => {` | Baca cache dulu |
| `src/api/useSessionTemplates.ts:83` | `.then((result) => {` | Terima hasil API |
| `src/db.ts:26` | `.then(async (db) => {` | Buka SQLite |
| `src/app/(tabs)/players.tsx:51` | `.then((error) => {` | Aksi pemain |

Contoh terbaik — **`src/api/useSessionTemplates.ts:82–101`**:

```ts
fetchSessionTemplates({ useMock, signal: controller.signal })
  .then((result) => {
    ...
  })
  .catch((e) => {
    ...
  })
  .finally(() => {
    ...
  });
```

Cache juga memakai `.then()` — **`src/api/useSessionTemplates.ts:71–79`**:

```ts
readCachedTemplateList()
  .then((cached) => { ... })
  .catch(() => undefined);
```

`.catch()` / `.finally()` terkait:

| File:Line | Fungsi |
|---|---|
| `src/api/useSessionTemplates.ts:79` | `.catch()` cache |
| `src/api/useSessionTemplates.ts:92` | `.catch()` fetch API |
| `src/api/useSessionTemplates.ts:97` | `.finally()` matikan loading |
| `src/db.ts:32` | `.catch()` gagal buka DB |
| `src/app/(tabs)/players.tsx:54` | `.catch()` aksi pemain |
| `src/auth/accountApi.ts:154` | `.finally()` reset refresh promise |

### 5.2 `resolve` / `reject` di dalam `new Promise`

**`src/api/client.ts:70`** — executor:

```ts
return new Promise((resolve, reject) => {
```

- `resolve()` → **`src/api/client.ts:73`**
- `reject()` → **`src/api/client.ts:77`**

**`src/api/http.ts:37`** — executor:

```ts
return new Promise((resolve, reject) => {
```

- `resolve()` → **`src/api/http.ts:40`**
- `reject()` → **`src/api/http.ts:44`**

Contoh lengkap — **`src/api/http.ts:34–48`**:

```ts
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
```

### 5.3 `Promise.resolve()` / `Promise.reject()` statis

| File:Line | Kode |
|---|---|
| `src/api/client.ts:67` | `return Promise.reject(Object.assign(new Error('Aborted'), ...))` |
| `src/api/client.ts:69` | `if (ms <= 0) return Promise.resolve();` |
| `src/api/http.ts:35` | `if (signal?.aborted) return Promise.reject(abortError());` |
| `src/api/http.ts:36` | `if (ms <= 0) return Promise.resolve();` |

### 5.4 Penjelasan penting

- `resolve` dan `reject` **bukan method dari object Promise**. Keduanya adalah callback parameter di `new Promise((resolve, reject) => ...)`.
- `Promise.resolve()` dan `Promise.reject()` adalah **static method** untuk membuat Promise yang langsung selesai/gagal.
- Proyek ini memakai keduanya, jadi aman kalau dosen menanyakan versi mana pun.

Kalimat yang bisa dipakai:

> “`resolve()` menandai Promise berhasil, `reject()` menandai Promise gagal. Keduanya dikirim ke executor `new Promise`. Di kode ini saya juga memakai `Promise.resolve()` dan `Promise.reject()` untuk early return saat delay 0 atau request sudah dibatalkan.”

---

## 6. Bukti test

| File:Line | Yang dibuktikan |
|---|---|
| `src/api/__tests__/mapping.test.ts:4` | `name` → `title`, `created_at` dibuang |
| `src/api/__tests__/mapping.test.ts:29` | Item invalid ditolak |
| `src/api/__tests__/mapping.test.ts:72` | Fallback `minPlayers`/`targetScore` |
| `src/api/__tests__/client.test.ts:51` | Response API dipetakan + cache disimpan |
| `src/api/__tests__/client.test.ts:60` | Fallback cache saat offline |
| `src/api/__tests__/http.test.ts:26` | Response JSON sukses |
| `src/api/__tests__/http.test.ts:33` | Retry request |
| `src/api/__tests__/http.test.ts:81` | Timeout |
| `src/api/__tests__/http.test.ts:96` | Abort |
| `src/api/__tests__/http.test.ts:84` | `new Promise((_resolve, reject) => ...)` |
| `src/auth/__tests__/accountApi.test.ts:74` | Login menyimpan token |
| `src/sync/__tests__/snapshot.test.ts` | Validasi snapshot |

Jalankan test terkait:

```powershell
bunx jest src/api/__tests__/mapping.test.ts src/api/__tests__/client.test.ts src/api/__tests__/http.test.ts --runInBand
```

Semua test:

```powershell
bun run test -- --runInBand
```

Saat ini total **81 test lulus**.

---

## 7. Persiapan demo

### 7.1 Buat `.env.local`

Di root project, buat file `.env.local` (gitignored):

```env
EXPO_PUBLIC_API_URL=https://remi-scoreboard-backend.vercel.app
```

Tanpa env ini, aplikasi memakai mock dan menampilkan badge **“Data demo lokal”**.

### 7.2 Jalankan aplikasi

```powershell
bunx expo start -c
```

Tekan `w` untuk web (paling mudah untuk menunjukkan Network tab), atau pakai Expo Go.

### 7.3 Checklist tampilan

- [ ] Tab Home terbuka.
- [ ] Daftar **Template Sesi** muncul.
- [ ] Tidak ada badge “Data demo lokal”.
- [ ] Klik template aktif → form create terisi `minPlayers`/`targetScore`.
- [ ] Chrome DevTools → Network → filter `api/templates` → status 200.

### 7.4 Cek API dari terminal

```powershell
Invoke-RestMethod https://remi-scoreboard-backend.vercel.app/api/templates | ConvertTo-Json -Depth 5
```

Harus keluar 4 template:

- Remi Santai
- Remi Serius
- Turnamen Mingguan
- Arsip 2023 (Nonaktif)

---

## 8. Script demo (±8 menit)

### Menit 1 — Bukti external API

Tampilkan Home screen, lalu terminal:

```powershell
Invoke-RestMethod https://remi-scoreboard-backend.vercel.app/api/templates | ConvertTo-Json -Depth 5
```

Yang dikatakan:

> “Empat template di layar ini tidak di-hardcode. Sumbernya REST API `GET /api/templates`. Backend Vercel mengambil datanya dari Supabase lewat `fetch` di `backend/lib/db.js:13`. Secret key Supabase hanya ada di server.”

Kalau demo di web, buka **Chrome DevTools → Network → filter `api/templates`**, tunjukkan status 200 dan tab Response.

### Menit 2–4 — Interface & object mapping

Buka `src/api/dto.ts`:

1. Baris 27 — `ServerTemplateJson`: bentuk mentah JSON server.
2. Baris 41 — `SessionTemplate`: object yang dipakai UI.
3. Baris 78 — `mapServerTemplateToTemplate`: validasi + mapping.
4. Baris 86 — `return { ... }`: object literal bertipe `SessionTemplate`.
5. Baris 99 — `mapServerTemplateList`: array JSON → `SessionTemplate[]`.

Lalu `src/api/client.ts`:

- Baris 125 — `data` masih `unknown`.
- Baris 133 — `mapServerTemplateList(data)` mengubahnya menjadi object.

Lalu `src/components/TemplateSection.tsx:94–126`:

- “UI memakai `t.title`, `t.minPlayers`, `t.targetScore`.”

### Menit 4–6 — Custom & pre-built async

Custom:

- `fetchSessionTemplates` — `src/api/client.ts:108`
- `requestJson` — `src/api/http.ts:152`
- `requestOnce` — `src/api/http.ts:78`

Pre-built:

- `fetch()` — `src/api/http.ts:99`
- `response.text()` — `src/api/http.ts:66`
- `SQLite.openDatabaseAsync()` — `src/db.ts:25`
- `Promise.all()` — `src/store.ts:77`

### Menit 6–8 — `.then`, `resolve`, `reject`

Buka `src/api/useSessionTemplates.ts:82–101`:

- `.then()` menerima hasil API.
- `.catch()` menangani error.
- `.finally()` mematikan loading.

Buka `src/api/http.ts:34–48`:

- `resolve()` di baris 40.
- `reject()` di baris 44.
- `Promise.resolve()` di baris 36.
- `Promise.reject()` di baris 35.

Buka `src/api/client.ts:65–80` untuk pola yang sama pada `delay()`.

Tutup dengan:

```powershell
bunx jest src/api/__tests__/mapping.test.ts src/api/__tests__/client.test.ts src/api/__tests__/http.test.ts --runInBand
```

---

## 9. Q&A cheat sheet

| Pertanyaan | Jawaban singkat | Bukti |
|---|---|---|
| Di mana external API-nya? | Supabase REST via backend | `backend/lib/db.js:13` |
| Di mana `fetch` dari aplikasi? | `requestOnce` memanggil `fetch(url)` | `src/api/http.ts:99` |
| Di mana interface-nya? | `ServerTemplateJson` dan `SessionTemplate` | `src/api/dto.ts:27,41` |
| Di mana data masuk ke object? | `return { ... }` di mapper | `src/api/dto.ts:86` |
| Di mana custom async? | `fetchSessionTemplates`, `requestJson` | `client.ts:108`, `http.ts:152` |
| Di mana pre-built async? | `fetch`, `response.text`, `openDatabaseAsync` | `http.ts:99,66`, `db.ts:25` |
| Di mana `.then()`? | Hook pemuat template & buka DB | `useSessionTemplates.ts:72,83`, `db.ts:26` |
| Di mana `resolve`/`reject`? | `sleep()` dan `delay()` | `http.ts:34–49`, `client.ts:65–80` |
| Kenapa tidak langsung ke Supabase? | Secret key tidak boleh ada di mobile app | Backend sebagai proxy |
| Kalau offline? | Fallback cache SQLite | `client.ts:139–147` |
| Kenapa ada data mock? | Env `EXPO_PUBLIC_API_URL` belum diisi | `client.ts:52–54` |

---

## 10. Troubleshooting

### API 500

- Restore project Supabase jika paused.
- Cek `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TOKEN_SECRET` di Vercel.
- Lihat Vercel Functions Logs.
- Redeploy setelah mengubah env.

### Aplikasi menampilkan “Data demo lokal”

`EXPO_PUBLIC_API_URL` belum terbaca. Buat `.env.local`, lalu restart:

```powershell
bunx expo start -c
```

### Aplikasi menampilkan “Template tersimpan”

Aplikasi sedang memakai cache SQLite karena request jaringan gagal. Ini normal saat offline, tapi untuk demo external API pastikan request jaringan berhasil.

### `expo-doctor` memberi warning versi package

Saat ini ada 17 package versi patch lebih lama dari rekomendasi SDK 58. Ini tidak menghalangi `expo start`. Jangan jalankan `expo install --fix` tepat sebelum demo karena akan mengubah `package.json` dan `bun.lock`.

### API tetap down saat demo

Opsi cadangan:

1. Rekam video demo saat API sudah hidup.
2. Jalankan backend lokal dengan `.env` Supabase dan `bunx vercel dev`.
3. Set `EXPO_PUBLIC_API_URL=http://localhost:3000` untuk demo di web.
4. Jika terpaksa, gunakan mock dan jelaskan bahwa jalur API tetap dibuktikan lewat kode + test.

---

## 11. Buka cepat di VS Code

```text
Ctrl+P → src/api/dto.ts                  → Ctrl+G → 78
Ctrl+P → src/api/client.ts               → Ctrl+G → 108
Ctrl+P → src/api/http.ts                 → Ctrl+G → 34
Ctrl+P → src/api/useSessionTemplates.ts  → Ctrl+G → 82
Ctrl+P → src/components/TemplateSection.tsx → Ctrl+G → 94
```

Urutan demo yang disarankan:

1. `src/api/dto.ts:27,41,78`
2. `src/api/client.ts:108,125,133`
3. `src/api/http.ts:99`
4. `src/api/useSessionTemplates.ts:82–101`
5. `src/api/http.ts:34–48`
6. `src/api/client.ts:65–80`

---

## 12. Checklist akhir

- [ ] Supabase project aktif.
- [ ] Vercel env benar dan sudah redeploy.
- [ ] `GET /api/templates` mengembalikan 200 + array.
- [ ] `.env.local` berisi `EXPO_PUBLIC_API_URL`.
- [ ] `bunx expo start -c` berjalan.
- [ ] Home menampilkan template tanpa badge “Data demo lokal”.
- [ ] Klik template → form create terisi aturan dari API.
- [ ] Test `mapping`, `client`, `http` lulus.
- [ ] File-file di atas sudah dibuka di editor.
- [ ] Punya video/screenshot cadangan.

---

## 13. Fitur Peta Arena & Geofencing

Fitur ini adalah bagian dari aplikasi scoreboard, bukan demo terpisah. Arena disimpan per sesi dan bisa dibuka dari Home, layar game, atau tab kelima **Peta**.

### Yang sudah tersedia

- Peta interaktif Android/iOS dengan posisi perangkat.
- Titik arena per sesi, bisa diketuk di peta, digeser, atau memakai lokasi saat ini.
- Reverse geocoding alamat dengan fallback koordinat saat offline.
- Radius arena 100/200/500 m.
- Status jarak `Di dalam arena` / `Di luar arena`.
- Pengingat area dengan event masuk/keluar. Event tampil di riwayat in-app.
- Event latar belakang ditulis ke SQLite oleh task geofence; event foreground memakai perhitungan jarak saat tab Peta terbuka.
- Semua data lokasi hanya tersimpan lokal di SQLite. Tidak ada perubahan model `GameSession` dan tidak ada pengiriman lokasi ke server.

### File utama untuk dibuka saat demo

```text
src/app/(tabs)/map.tsx                  → layar Peta Arena
src/components/MapCanvas.native.tsx     → peta Android/iOS
src/components/MapCanvas.tsx            → fallback web
src/components/ArenaCard.tsx            → titik, radius, status, toggle geofence
src/components/GeofenceHistory.tsx      → riwayat event
src/location/geofenceTask.ts            → task background
src/location/geofence.ts                → sinkronisasi region
src/location/geocoding.ts               → reverse geocode + cache
src/db.ts                               → tabel session_locations & geofence_events
src/store.ts                            → aksi arena & event
```

### Alur demo singkat (Expo Go)

1. Jalankan `bunx expo start -c`, buka di Android/iOS.
2. Dari Home, ketuk kartu **Tandai Arena Sesi** pada sesi yang sedang berjalan, atau buka tab **Peta**.
3. Pilih sesi berjalan di bagian **Pilih Sesi**.
4. Ketuk peta untuk menaruh pin, atau tekan **Lokasi Saya** / **Jadikan Arena**.
5. Tunggu alamat muncul dari reverse geocoding. Jika offline, alamat akan memakai fallback koordinat.
6. Pilih radius **100 m**, **200 m**, atau **500 m**, lalu tekan **Simpan Arena**.
7. Status jarak berubah menjadi **Di dalam arena** atau **Di luar arena** berdasarkan posisi perangkat.
8. Aktifkan **Pengingat area**. Izinkan lokasi saat digunakan; jika diminta izin “Selalu”, izinkan untuk demo background.
9. Berjalan keluar/masuk radius. Saat tab Peta terbuka, event foreground langsung muncul di **Riwayat Area**.
10. Buka lagi sesi dari banner **Arena Sesi** di layar game atau menu **Peta Arena Sesi** untuk menunjukkan integrasi.

### Demo geofence background

Background geofencing **tidak berjalan di Expo Go**. Untuk menunjukkan event saat aplikasi di latar belakang:

```bash
bunx eas-cli build --profile preview --platform android
# atau build native lokal:
bunx expo run:android
```

Di Android, APK preview/native juga membutuhkan Google Maps API key agar peta tampil (lihat catatan di bawah). Tanpa key, geofence tetap bisa berjalan tetapi peta bisa kosong. iOS memakai Apple Maps sehingga tidak memerlukan key.

Setelah build native terpasang:

1. Buka tab **Peta**, pilih sesi, simpan arena, aktifkan **Pengingat area**.
2. Pada iOS pilih **Always**; pada Android 11+ buka **App info → Permissions → Location → Allow all the time**. Di beberapa perangkat, Expo akan membuka halaman Settings.
3. Tekan tombol Home agar aplikasi masuk background, lalu berjalan melewati radius.
4. Buka kembali aplikasi. Event background akan dimuat dari SQLite dan muncul di **Riwayat Area** dengan label **Latar belakang**.
5. Jika izin “Selalu” tidak diberikan, fitur tetap bisa didemokan sebagai fallback foreground: event tercatat saat tab Peta terbuka, dan kartu arena menampilkan catatan bahwa background membutuhkan izin “Selalu”.

### Catatan Android standalone/EAS

- `react-native-maps` memakai Google Maps di Android. Di **Expo Go**, API key sudah disediakan oleh Expo.
- Untuk APK/AAB standalone, buat API key di Google Cloud Console dengan **Maps SDK for Android** aktif, lalu daftarkan lewat config plugin `react-native-maps`:

```json
[
  "react-native-maps",
  {
    "androidGoogleMapsApiKey": "API_KEY_ANDA"
  }
]
```

- Tanpa API key tersebut, peta Android di build standalone bisa tampil kosong meskipun aplikasi tidak crash. Jangan commit API key ke repository; gunakan environment/secret saat build.
- iOS memakai Apple Maps dan tidak memerlukan Google Maps API key.
- Web hanya menampilkan fallback ringkasan koordinat dan tombol **Buka di OpenStreetMap**, karena `react-native-maps` tidak mendukung web.

### Batasan yang perlu dijelaskan jujur

- Tidak ada notifikasi lokal; event ditampilkan sebagai banner status dan riwayat in-app.
- Lokasi tidak disinkronkan ke cloud dan tidak dibagikan ke pemain lain.
- Reverse geocoding membutuhkan jaringan; tanpa jaringan aplikasi tetap menyimpan koordinat.
- Radius/geofence baru aktif setelah arena disimpan.
- Sesi selesai bersifat read-only untuk arena.
- Uji background memerlukan build native (preview APK atau `expo run:android`); jangan jadwalkan demo background memakai Expo Go.

### Verifikasi cepat

```bash
bunx tsc --noEmit
bunx expo lint
bun run test -- --runInBand
```

Test saat ini mencakup perhitungan haversine, format jarak, format alamat, pembentukan region geofence, serta aksi store arena/event.
