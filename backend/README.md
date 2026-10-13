# PentungScore Backend

REST API untuk auth token + leaderboard. Bun + Hono + SQLite (`bun:sqlite`).

## Jalan cepat

```bash
cd backend
cp .env.example .env
# isi JWT_SECRET minimal 32 karakter acak:
bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
bun install
bun run dev   # http://localhost:3000
```

## Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/health` | — | cek hidup |
| POST | `/auth/register` | — | `{name,email,password}` → 201 + sesi |
| POST | `/auth/login` | — | `{email,password}` → sesi |
| POST | `/auth/refresh` | — | `{refreshToken}` → rotasi sesi |
| POST | `/auth/logout` | — | `{refreshToken}` → cabut sesi |
| GET | `/me` | Bearer | profil user |
| GET | `/leaderboard` | Bearer | `{data, total}` |

Access token JWT 15 menit, refresh opaque 30 hari dengan rotasi + deteksi reuse
(pakai ulang token lama → semua sesi user dicabut).

## Demo

```bash
curl -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dika","email":"demo@pentung.app","password":"demo1234"}'
```

## Test & typecheck

```bash
bun test
bun run typecheck
```
