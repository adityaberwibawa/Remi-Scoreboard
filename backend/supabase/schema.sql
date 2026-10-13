-- Run this once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.account_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.account_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_user_id_idx on public.refresh_tokens(user_id);
create index if not exists refresh_tokens_expires_at_idx on public.refresh_tokens(expires_at);

alter table public.account_users enable row level security;
alter table public.refresh_tokens enable row level security;

revoke all on table public.account_users, public.refresh_tokens from anon, authenticated;
grant all on table public.account_users, public.refresh_tokens to service_role;
