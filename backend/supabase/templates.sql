-- Run this once in Supabase Dashboard > SQL Editor (after schema.sql).
-- Tabel template sesi untuk endpoint GET /api/templates (data publik, non-sensitif).
create table if not exists public.session_templates (
  id integer generated always as identity primary key,
  name text not null,
  description text not null default '',
  image text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  min_players integer not null default 2 check (min_players between 2 and 6),
  target_score_enabled boolean not null default false,
  target_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_templates enable row level security;

revoke all on table public.session_templates from anon, authenticated;
grant all on table public.session_templates to service_role;

-- Seed contoh template; hanya jalan bila tabel masih kosong (aman diulang).
insert into public.session_templates
  (name, description, status, min_players, target_score_enabled, target_score)
select name, description, status, min_players, target_score_enabled, target_score
from (values
  ('Remi Santai', 'Template sesi santai 4 pemain, cocok untuk mabar keluarga.', 'active', 4, false, 0),
  ('Remi Serius', 'Template sesi 6 pemain dengan target skor 500.', 'active', 2, true, 500),
  ('Turnamen Mingguan', 'Template turnamen multi-ronde untuk komunitas.', 'active', 4, false, 0),
  ('Arsip 2023 (Nonaktif)', 'Template lama yang sudah tidak dipakai.', 'inactive', 2, false, 0)
) as seeds(name, description, status, min_players, target_score_enabled, target_score)
where not exists (select 1 from public.session_templates);
