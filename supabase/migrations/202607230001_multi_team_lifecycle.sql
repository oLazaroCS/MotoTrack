-- Multi-team memberships, automatic immutable team codes and complete lifecycle rules.

create or replace function public.generate_team_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'EQP-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    exit when not exists (select 1 from public.teams where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.fill_team_join_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and (new.join_code is null or btrim(new.join_code) = '') then
    new.join_code := public.generate_team_join_code();
  elsif tg_op = 'UPDATE' and new.join_code is distinct from old.join_code then
    raise exception 'O código da equipe é gerado automaticamente e não pode ser alterado';
  end if;
  return new;
end;
$$;

drop trigger if exists fill_team_join_code on public.teams;
create trigger fill_team_join_code
before insert or update of join_code on public.teams
for each row execute function public.fill_team_join_code();

create table if not exists public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'driver',
  status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_memberships_user_idx
  on public.team_memberships (user_id, status);
create index if not exists team_memberships_team_status_idx
  on public.team_memberships (team_id, status);

insert into public.team_memberships (team_id, user_id, role, status)
select team_id, id, role, account_status
from public.profiles
where team_id is not null
on conflict (team_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    updated_at = now();

create or replace function public.is_active_member(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships
    where user_id = auth.uid()
      and team_id = target_team
      and status = 'active'
  )
$$;

create or replace function public.is_team_admin_for(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships
    where user_id = auth.uid()
      and team_id = target_team
      and role = 'admin'
      and status = 'active'
  )
$$;

create or replace function public.shares_active_team(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships viewer
    join public.team_memberships target on target.team_id = viewer.team_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and target.user_id = target_user
      and target.status = 'active'
  )
$$;

create or replace function public.has_team_membership(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_memberships
    where user_id = auth.uid() and team_id = target_team
  )
$$;

create or replace function public.can_read_profile(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user = auth.uid()
    or public.is_master_admin()
    or exists (
      select 1
      from public.team_memberships viewer
      join public.team_memberships target on target.team_id = viewer.team_id
      where viewer.user_id = auth.uid()
        and viewer.status = 'active'
        and target.user_id = target_user
        and (target.status = 'active' or viewer.role = 'admin')
    )
$$;

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.team_id
  from public.profiles p
  where p.id = auth.uid()
    and (
      p.is_master_admin
      or exists (
        select 1
        from public.team_memberships m
        where m.user_id = p.id
          and m.team_id = p.team_id
          and m.status = 'active'
      )
    )
$$;

create or replace function public.is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team_admin_for(public.current_team_id())
$$;

create or replace function public.is_active_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_team_id() is not null
$$;

create or replace function public.set_active_team(target_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.team_memberships;
begin
  select * into membership
  from public.team_memberships
  where user_id = auth.uid()
    and team_id = target_team
    and status = 'active';

  if membership.user_id is null then
    raise exception 'Você não é um membro ativo desta equipe';
  end if;

  update public.profiles
  set team_id = target_team,
      role = membership.role,
      account_status = 'active',
      updated_at = now()
  where id = auth.uid()
    and not is_master_admin;

  update public.driver_locations
  set team_id = target_team
  where user_id = auth.uid();
end;
$$;

create or replace function public.join_team_by_code(team_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team uuid;
  current_profile public.profiles;
begin
  select * into current_profile from public.profiles where id = auth.uid();
  if current_profile.id is null or current_profile.is_master_admin then
    raise exception 'Conta não autorizada a entrar em equipes';
  end if;

  select id into target_team
  from public.teams
  where upper(join_code) = upper(btrim(team_code));

  if target_team is null then
    raise exception 'Código de equipe inválido';
  end if;

  insert into public.team_memberships (team_id, user_id, role, status)
  values (target_team, auth.uid(), 'driver', 'pending')
  on conflict (team_id, user_id) do nothing;

  if current_profile.team_id is null then
    update public.profiles
    set team_id = target_team,
        role = 'driver',
        account_status = 'pending',
        updated_at = now()
    where id = auth.uid();
  end if;

  return target_team;
end;
$$;

create or replace function public.sync_profile_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user uuid := coalesce(new.user_id, old.user_id);
  affected_team uuid := coalesce(new.team_id, old.team_id);
  replacement public.team_memberships;
begin
  if tg_op <> 'DELETE'
    and new.status = 'active'
    and exists (
      select 1 from public.profiles
      where id = affected_user and team_id is null and not is_master_admin
    ) then
    update public.profiles
    set team_id = new.team_id,
        role = new.role,
        account_status = 'active',
        updated_at = now()
    where id = affected_user;
    return coalesce(new, old);
  end if;

  if exists (
    select 1
    from public.profiles
    where id = affected_user
      and team_id = affected_team
      and not is_master_admin
  ) then
    if tg_op = 'UPDATE' and new.status = 'active' then
      update public.profiles
      set role = new.role,
          account_status = 'active',
          updated_at = now()
      where id = affected_user;
    elsif tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.status <> 'active') then
      select * into replacement
      from public.team_memberships
      where user_id = affected_user
        and status = 'active'
        and team_id <> affected_team
      order by created_at
      limit 1;

      update public.profiles
      set team_id = replacement.team_id,
          role = coalesce(replacement.role, 'driver'),
          account_status = case when replacement.team_id is null then 'inactive' else 'active' end,
          updated_at = now()
      where id = affected_user;

      update public.driver_locations
      set team_id = replacement.team_id,
          is_online = case when replacement.team_id is null then false else is_online end,
          last_online_at = case when replacement.team_id is null and is_online then now() else last_online_at end
      where user_id = affected_user;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_profile_from_membership on public.team_memberships;
create trigger sync_profile_from_membership
after insert or update or delete on public.team_memberships
for each row execute function public.sync_profile_from_membership();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team uuid;
begin
  select id into target_team
  from public.teams
  where upper(join_code) = upper(new.raw_user_meta_data ->> 'team_code');
  if target_team is null then
    raise exception 'Código de equipe inválido';
  end if;

  insert into public.profiles (
    id, name, nickname, email, phone, driver_code, team_id, account_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'driver_code',
    target_team,
    'pending'
  );

  insert into public.team_memberships (team_id, user_id, role, status)
  values (target_team, new.id, 'driver', 'pending');
  return new;
end;
$$;

alter table public.driver_locations alter column team_id drop not null;
alter table public.driver_locations
  drop constraint if exists driver_locations_team_id_fkey;
alter table public.driver_locations
  add constraint driver_locations_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_team_id_fkey;
alter table public.profiles
  add constraint profiles_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

alter table public.team_memberships enable row level security;

drop policy if exists "profiles visible by scope" on public.profiles;
create policy "profiles visible by scope" on public.profiles
for select to authenticated
using (
  public.can_read_profile(id)
);

drop policy if exists "teams visible by scope" on public.teams;
create policy "teams visible by scope" on public.teams
for select to authenticated
using (
  public.is_master_admin()
  or public.has_team_membership(id)
);

drop policy if exists "memberships visible by scope" on public.team_memberships;
create policy "memberships visible by scope" on public.team_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_master_admin()
  or (
    public.is_active_member(team_id)
    and (
      status = 'active'
      or public.is_team_admin_for(team_id)
    )
  )
);

drop policy if exists "locations visible by scope" on public.driver_locations;
create policy "locations visible by scope" on public.driver_locations
for select to authenticated
using (
  public.is_master_admin()
  or user_id = auth.uid()
  or (
    public.shares_active_team(user_id)
    and (
      is_online
      or exists (
        select 1
        from public.team_memberships viewer
        join public.team_memberships target on target.team_id = viewer.team_id
        where viewer.user_id = auth.uid()
          and viewer.role = 'admin'
          and viewer.status = 'active'
          and target.user_id = driver_locations.user_id
      )
    )
  )
);

drop policy if exists "members insert own presence" on public.driver_locations;
create policy "members insert own presence" on public.driver_locations
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_member(public.current_team_id())
);

drop policy if exists "members update own presence" on public.driver_locations;
create policy "members update own presence" on public.driver_locations
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_active_member(public.current_team_id())
);

drop policy if exists "members insert own history" on public.location_history;
create policy "members insert own history" on public.location_history
for insert to authenticated
with check (
  user_id = auth.uid()
  and team_id = public.current_team_id()
  and public.is_active_member(team_id)
);

drop policy if exists "history visible by admins" on public.location_history;
create policy "history visible by admins" on public.location_history
for select to authenticated
using (
  public.is_master_admin()
  or public.is_team_admin_for(team_id)
);

create or replace function public.can_read_team_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      split_part(object_name, '/', 1) = auth.uid()::text
      or public.is_master_admin()
      or exists (
        select 1 from public.profiles
        where id::text = split_part(object_name, '/', 1)
          and public.shares_active_team(id)
      )
    )
$$;

drop policy if exists "scoped team logo reads" on storage.objects;
create policy "scoped team logo reads" on storage.objects
for select to authenticated using (
  bucket_id = 'team-logos'
  and (
    public.is_master_admin()
    or exists (
      select 1 from public.teams
      where id::text = (storage.foldername(name))[1]
        and public.has_team_membership(id)
    )
  )
);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_master_admin()
  )
);

drop policy if exists "master deletes team logos" on storage.objects;
create policy "master deletes team logos" on storage.objects
for delete to authenticated
using (bucket_id = 'team-logos' and public.is_master_admin());

update storage.buckets
set file_size_limit = 10485760
where id in ('avatars', 'team-logos');

grant select on public.team_memberships to authenticated;
grant execute on function public.set_active_team(uuid) to authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_memberships'
  ) then
    alter publication supabase_realtime add table public.team_memberships;
  end if;
end
$$;
