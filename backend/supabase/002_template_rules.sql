-- Jalankan sekali bila tabel session_templates sudah dibuat sebelumnya (upgrade v2).
-- Menambah aturan template: minimum pemain & batas poin akhir game.
alter table public.session_templates
  add column if not exists min_players integer not null default 2,
  add column if not exists target_score_enabled boolean not null default false,
  add column if not exists target_score integer not null default 0;

update public.session_templates
   set min_players = 4
 where name = 'Remi Santai';

update public.session_templates
   set min_players = 2,
       target_score_enabled = true,
       target_score = 500
 where name = 'Remi Serius';
