create extension if not exists pgcrypto;

create type public.user_role as enum ('driver', 'admin');
create type public.account_status as enum ('active', 'inactive');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique check (char_length(join_code) >= 6),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  email text not null,
  phone text,
  avatar_url text,
  driver_code text not null,
  role public.user_role not null default 'driver',
  account_status public.account_status not null default 'active',
  team_id uuid not null references public.teams(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, driver_code)
);

create table public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  speed double precision check (speed is null or speed >= 0),
  heading double precision check (heading is null or heading between 0 and 360),
  is_online boolean not null default false,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_online_at timestamptz
);

create table public.location_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  captured_at timestamptz not null default now()
);
create index location_history_retention_idx on public.location_history (captured_at);
create index driver_locations_team_online_idx on public.driver_locations (team_id, is_online);

create or replace function public.current_team_id()
returns uuid language sql stable security definer set search_path = public
as $$ select team_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and account_status = 'active') $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_team uuid;
begin
  select id into target_team from public.teams where upper(join_code) = upper(new.raw_user_meta_data ->> 'team_code');
  if target_team is null then raise exception 'Código de equipe inválido'; end if;
  insert into public.profiles (id, name, email, phone, driver_code, team_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email,
    new.raw_user_meta_data ->> 'phone', new.raw_user_meta_data ->> 'driver_code', target_team);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user = 'postgres' then new.updated_at := now(); return new; end if;
  if new.id <> old.id or new.team_id <> old.team_id or new.role <> old.role or new.account_status <> old.account_status or new.email <> old.email or new.driver_code <> old.driver_code then
    raise exception 'Campos protegidos do perfil não podem ser alterados';
  end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger protect_profile before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.guard_location_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare member public.profiles;
begin
  if auth.role() = 'service_role' or current_user = 'postgres' then
    new.updated_at := now();
    if tg_op = 'UPDATE' and new.is_online = false and old.is_online = true then new.last_online_at := now(); end if;
    return new;
  end if;
  select * into member from public.profiles where id = auth.uid();
  if member.id is null or member.account_status <> 'active' or new.user_id <> auth.uid() then raise exception 'Usuário não autorizado para compartilhar localização'; end if;
  new.team_id := member.team_id;
  new.updated_at := greatest(coalesce(new.captured_at, now()), now() - interval '2 minutes');
  if tg_op = 'UPDATE' and new.is_online = false and old.is_online = true then new.last_online_at := now(); end if;
  return new;
end;
$$;
create trigger protect_location before insert or update on public.driver_locations for each row execute function public.guard_location_write();

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.location_history enable row level security;

create policy "members read own team" on public.profiles for select to authenticated using (team_id = public.current_team_id());
create policy "members update own public fields" on public.profiles for update to authenticated using (id = auth.uid() and account_status = 'active') with check (id = auth.uid());
create policy "members read team presence" on public.driver_locations for select to authenticated using (team_id = public.current_team_id() and (is_online or public.is_team_admin()));
create policy "members insert own presence" on public.driver_locations for insert to authenticated with check (user_id = auth.uid() and team_id = public.current_team_id());
create policy "members update own presence" on public.driver_locations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and team_id = public.current_team_id());
create policy "members insert own history" on public.location_history for insert to authenticated with check (user_id = auth.uid() and team_id = public.current_team_id());
create policy "admins read team history" on public.location_history for select to authenticated using (team_id = public.current_team_id() and public.is_team_admin());

revoke all on public.teams, public.profiles, public.driver_locations, public.location_history from anon;
revoke update on public.profiles from authenticated;
grant select on public.profiles, public.driver_locations to authenticated;
grant update (name, phone, avatar_url, updated_at) on public.profiles to authenticated;
grant insert, update on public.driver_locations to authenticated;
grant insert, select on public.location_history to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy "team reads avatars" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and exists(select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1] and p.team_id = public.current_team_id())
);
create policy "users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.driver_locations;

-- Optional retention job. Enable pg_cron in the Supabase dashboard before running:
-- select cron.schedule('purge-location-history', '30 3 * * *', $$delete from public.location_history where captured_at < now() - interval '30 days'$$);
