alter table public.profiles add column if not exists nickname text;

update public.profiles
set
  name = case when char_length(btrim(name)) >= 3 then left(btrim(name), 80) else 'Usuário ' || upper(substr(replace(id::text, '-', ''), 1, 8)) end,
  phone = case when char_length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) between 10 and 15 then regexp_replace(phone, '[^0-9]', '', 'g') else null end,
  nickname = case
    when char_length(coalesce(nullif(btrim(nickname), ''), split_part(btrim(name), ' ', 1))) >= 2 then left(coalesce(nullif(btrim(nickname), ''), split_part(btrim(name), ' ', 1)), 30)
    else 'Membro-' || upper(substr(replace(id::text, '-', ''), 1, 8))
  end,
  driver_code = case
    when driver_code is null or char_length(regexp_replace(driver_code, '[^A-Za-z0-9_-]', '', 'g')) < 3
      then 'MT-' || upper(substr(replace(id::text, '-', ''), 1, 8))
    else left(upper(regexp_replace(btrim(driver_code), '[^A-Za-z0-9_-]', '', 'g')), 24)
  end;

with duplicates as (
  select id, driver_code, row_number() over (partition by lower(driver_code) order by created_at, id) as position
  from public.profiles
)
update public.profiles p
set driver_code = left(d.driver_code, 15) || '-' || upper(substr(replace(p.id::text, '-', ''), 1, 8))
from duplicates d
where p.id = d.id and d.position > 1;

alter table public.profiles
  drop constraint if exists profiles_name_limit,
  drop constraint if exists profiles_nickname_limit,
  drop constraint if exists profiles_phone_limit,
  drop constraint if exists profiles_driver_code_format;

alter table public.profiles
  add constraint profiles_name_limit check (char_length(btrim(name)) between 3 and 80),
  add constraint profiles_nickname_limit check (nickname is null or char_length(btrim(nickname)) between 2 and 30),
  add constraint profiles_phone_limit check (phone is null or phone ~ '^[0-9]{10,15}$'),
  add constraint profiles_driver_code_format check (driver_code is null or driver_code ~ '^[A-Z0-9_-]{3,24}$');

create unique index if not exists profiles_driver_code_global_unique_idx
on public.profiles (lower(driver_code))
where driver_code is not null;

update public.teams set
  name = left(btrim(name), 80),
  tag = left(upper(btrim(tag)), 24),
  join_code = left(btrim(join_code), 64);

alter table public.teams
  drop constraint if exists teams_name_limit,
  drop constraint if exists teams_tag_limit,
  drop constraint if exists teams_join_code_limit;

alter table public.teams
  add constraint teams_name_limit check (char_length(btrim(name)) between 3 and 80),
  add constraint teams_tag_limit check (char_length(btrim(tag)) between 2 and 24),
  add constraint teams_join_code_limit check (char_length(btrim(join_code)) between 6 and 64);

create or replace function public.normalize_profile_identity()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.nickname := left(coalesce(nullif(btrim(new.nickname), ''), split_part(new.name, ' ', 1)), 30);
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if new.driver_code is not null then new.driver_code := upper(btrim(new.driver_code)); end if;
  return new;
end;
$$;

drop trigger if exists normalize_profile_identity on public.profiles;
create trigger normalize_profile_identity
before insert or update on public.profiles
for each row execute function public.normalize_profile_identity();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_team uuid;
begin
  select id into target_team
  from public.teams
  where upper(join_code) = upper(new.raw_user_meta_data ->> 'team_code');
  if target_team is null then raise exception 'Código de equipe inválido'; end if;

  insert into public.profiles (id, name, nickname, email, phone, driver_code, team_id, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'nickname',
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'driver_code',
    target_team,
    'pending'
  );
  return new;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (name, nickname, phone, avatar_url, updated_at) on public.profiles to authenticated;
