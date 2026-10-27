-- Run this once in Supabase Dashboard > SQL Editor (after schema.sql).
-- Cadangan cloud per akun untuk fitur Cadangkan / Pulihkan di aplikasi.
create table if not exists public.user_snapshots (
  user_id uuid primary key references public.account_users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

revoke all on table public.user_snapshots from anon, authenticated;
grant all on table public.user_snapshots to service_role;
