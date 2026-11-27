-- Jalankan sekali di Supabase Dashboard > SQL Editor (setelah 003_user_snapshots.sql).
-- Migrasi identitas ke Supabase Auth (auth.users): endpoint /api/auth/* sudah dihapus
-- dan backend memvalidasi access token Supabase, sehingga tabel akun custom tidak lagi
-- dipakai. Data lama dimulai dari nol (tidak ada migrasi baris).
drop table if exists public.user_snapshots cascade;
drop table if exists public.refresh_tokens cascade;
drop table if exists public.account_users cascade;

-- Cadangan cloud per-akun, sekarang terkait langsung ke auth.users.
create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

-- Akses hanya lewat backend memakai secret key (service_role), tidak dari klien anon.
revoke all on table public.user_snapshots from anon, authenticated;
grant all on table public.user_snapshots to service_role;
