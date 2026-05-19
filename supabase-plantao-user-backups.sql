-- Optional cloud history for PLANTAO.
-- Run this once in Supabase SQL Editor to enable versioned backups per account.

create table if not exists public.plantao_user_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  data jsonb not null,
  summary jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.plantao_user_backups enable row level security;

drop policy if exists plantao_user_backups_select_own on public.plantao_user_backups;
drop policy if exists plantao_user_backups_insert_own on public.plantao_user_backups;
drop policy if exists plantao_user_backups_select_admin on public.plantao_user_backups;
drop policy if exists plantao_user_backups_insert_admin on public.plantao_user_backups;

create policy plantao_user_backups_select_own
on public.plantao_user_backups
for select
to authenticated
using (auth.uid() = user_id);

create policy plantao_user_backups_insert_own
on public.plantao_user_backups
for insert
to authenticated
with check (auth.uid() = user_id);

create policy plantao_user_backups_select_admin
on public.plantao_user_backups
for select
to authenticated
using (auth.jwt() ->> 'email' = 'matheus34212019@gmail.com');

create policy plantao_user_backups_insert_admin
on public.plantao_user_backups
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'matheus34212019@gmail.com');

create index if not exists plantao_user_backups_user_created_idx
on public.plantao_user_backups (user_id, created_at desc);
