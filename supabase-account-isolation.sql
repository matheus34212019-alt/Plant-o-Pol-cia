-- Account isolation policies for PLANTAO.
-- Run once in the Supabase SQL Editor after the application tables exist.
-- The public browser key is safe only while row level security remains enabled.

begin;

create table if not exists public.plantao_user_data (
    user_id uuid primary key,
    email text,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.plantao_user_access (
    email text primary key,
    user_id uuid,
    name text,
    phone text,
    contest text,
    age integer,
    role text not null default 'aluno',
    status text not null default 'pending',
    requested_at timestamptz not null default now(),
    approved_at timestamptz,
    approved_by text
);

create table if not exists public.plantao_admin_backups (
    id uuid primary key default gen_random_uuid(),
    admin_email text,
    student_user_id uuid not null,
    student_email text,
    before_data jsonb not null,
    note text,
    created_at timestamptz not null default now()
);

create table if not exists public.plantao_user_backups (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    data jsonb not null,
    reason text,
    created_at timestamptz not null default now()
);

alter table public.plantao_user_data enable row level security;
alter table public.plantao_user_access enable row level security;
alter table public.plantao_admin_backups enable row level security;
alter table public.plantao_user_backups enable row level security;

do $$
declare
    existing_policy record;
begin
    for existing_policy in
        select tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('plantao_user_data', 'plantao_user_access', 'plantao_admin_backups', 'plantao_user_backups')
    loop
        execute format('drop policy if exists %I on public.%I', existing_policy.policyname, existing_policy.tablename);
    end loop;
end $$;

create policy plantao_user_data_read_own
on public.plantao_user_data
for select
to authenticated
using (auth.uid() = user_id);

create policy plantao_user_data_write_own
on public.plantao_user_data
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy plantao_user_data_admin_all
on public.plantao_user_data
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com');

create policy plantao_access_submit_request
on public.plantao_user_access
for insert
to anon, authenticated
with check (
    lower(coalesce(role, 'aluno')) = 'aluno'
    and lower(coalesce(status, 'pending')) = 'pending'
    and approved_at is null
    and approved_by is null
);

create policy plantao_access_read_own
on public.plantao_user_access
for select
to authenticated
using (
    auth.uid() = user_id
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy plantao_access_admin_all
on public.plantao_user_access
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com');

create policy plantao_admin_backups_admin_all
on public.plantao_admin_backups
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com');

create policy plantao_user_backups_read_own
on public.plantao_user_backups
for select
to authenticated
using (auth.uid() = user_id);

create policy plantao_user_backups_write_own
on public.plantao_user_backups
for insert
to authenticated
with check (auth.uid() = user_id);

create policy plantao_user_backups_admin_all
on public.plantao_user_backups
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com');

create or replace function public.plantao_save_user_data(
    p_user_id uuid,
    p_data jsonb,
    p_email text,
    p_expected_updated_at timestamptz default null
)
returns table(ok boolean, conflict boolean, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
    current_revision timestamptz;
    new_revision timestamptz := clock_timestamp();
    is_admin boolean := lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus34212019@gmail.com';
begin
    if auth.uid() is distinct from p_user_id and not is_admin then
        raise exception 'Permission denied' using errcode = '42501';
    end if;

    select stored.updated_at
      into current_revision
      from public.plantao_user_data as stored
     where stored.user_id = p_user_id
     for update;

    if current_revision is not null then
        if p_expected_updated_at is null or current_revision is distinct from p_expected_updated_at then
            return query select false, true, current_revision;
            return;
        end if;

        update public.plantao_user_data as stored
           set data = p_data,
               email = p_email,
               updated_at = new_revision
         where stored.user_id = p_user_id;
        return query select true, false, new_revision;
        return;
    end if;

    if p_expected_updated_at is not null then
        return query select false, true, null::timestamptz;
        return;
    end if;

    insert into public.plantao_user_data (user_id, email, data, updated_at)
    values (p_user_id, p_email, p_data, new_revision);
    return query select true, false, new_revision;
end;
$$;

revoke all on function public.plantao_save_user_data(uuid, jsonb, text, timestamptz) from public, anon;
grant execute on function public.plantao_save_user_data(uuid, jsonb, text, timestamptz) to authenticated;

create index if not exists plantao_user_data_updated_idx
on public.plantao_user_data (updated_at desc);

create index if not exists plantao_user_access_status_idx
on public.plantao_user_access (status, requested_at desc);

create index if not exists plantao_admin_backups_student_idx
on public.plantao_admin_backups (student_user_id, created_at desc);

create index if not exists plantao_user_backups_user_created_idx
on public.plantao_user_backups (user_id, created_at desc);

commit;