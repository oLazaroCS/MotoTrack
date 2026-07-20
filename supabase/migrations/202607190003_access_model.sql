alter table public.teams
  add column if not exists tag text,
  add column if not exists logo_url text,
  add column if not exists created_by uuid;

update public.teams
set tag = 'TEAM-' || upper(substr(id::text, 1, 8))
where tag is null or btrim(tag) = '';

alter table public.teams alter column tag set not null;
create unique index if not exists teams_tag_unique_idx on public.teams (lower(tag));

alter table public.profiles
  add column if not exists is_master_admin boolean not null default false;
alter table public.profiles alter column team_id drop not null;
alter table public.profiles alter column driver_code drop not null;

create or replace function public.is_master_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and is_master_admin = true and account_status = 'active'
  )
$$;

create or replace function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active' and team_id is not null
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_team uuid;
begin
  select id into target_team
  from public.teams
  where upper(join_code) = upper(new.raw_user_meta_data ->> 'team_code');
  if target_team is null then raise exception 'Código de equipe inválido'; end if;

  insert into public.profiles (id, name, email, phone, driver_code, team_id, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'driver_code',
    target_team,
    'pending'
  );
  return new;
end;
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user = 'postgres' then
    new.updated_at := now();
    return new;
  end if;
  if new.id <> old.id
    or new.team_id is distinct from old.team_id
    or new.role <> old.role
    or new.account_status <> old.account_status
    or new.email <> old.email
    or new.driver_code is distinct from old.driver_code
    or new.is_master_admin <> old.is_master_admin then
    raise exception 'Campos protegidos do perfil não podem ser alterados';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop policy if exists "members read own team" on public.profiles;
create policy "profiles visible by scope" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_master_admin()
  or (team_id is not null and team_id = public.current_team_id())
);

drop policy if exists "members read own team details" on public.teams;
create policy "teams visible by scope" on public.teams
for select to authenticated
using (public.is_master_admin() or id = public.current_team_id());

drop policy if exists "members read team presence" on public.driver_locations;
create policy "locations visible by scope" on public.driver_locations
for select to authenticated
using (
  public.is_master_admin()
  or (
    team_id = public.current_team_id()
    and (is_online or user_id = auth.uid() or public.is_team_admin())
  )
);

drop policy if exists "admins read team history" on public.location_history;
create policy "history visible by admins" on public.location_history
for select to authenticated
using (
  public.is_master_admin()
  or (team_id = public.current_team_id() and public.is_team_admin())
);

grant select on public.teams, public.profiles, public.driver_locations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "team reads avatars" on storage.objects;
create policy "scoped avatar reads" on storage.objects
for select to authenticated using (
  bucket_id = 'avatars'
  and (
    public.is_master_admin()
    or exists(
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and (p.id = auth.uid() or p.team_id = public.current_team_id())
    )
  )
);

drop policy if exists "scoped team logo reads" on storage.objects;
create policy "scoped team logo reads" on storage.objects
for select to authenticated using (
  bucket_id = 'team-logos'
  and (
    public.is_master_admin()
    or (storage.foldername(name))[1] = public.current_team_id()::text
  )
);

drop policy if exists "master uploads team logos" on storage.objects;
create policy "master uploads team logos" on storage.objects
for insert to authenticated with check (
  bucket_id = 'team-logos' and public.is_master_admin()
);

drop policy if exists "master updates team logos" on storage.objects;
create policy "master updates team logos" on storage.objects
for update to authenticated using (
  bucket_id = 'team-logos' and public.is_master_admin()
) with check (
  bucket_id = 'team-logos' and public.is_master_admin()
);
