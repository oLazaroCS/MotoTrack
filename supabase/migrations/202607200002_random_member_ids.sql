create or replace function public.generate_member_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate :=
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int) ||
      lpad(floor(random() * 100000)::int::text, 5, '0');
    exit when not exists (
      select 1 from public.profiles where lower(driver_code) = lower(candidate)
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_member_id() from public, anon, authenticated;

create or replace function public.normalize_profile_identity()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.nickname := left(coalesce(nullif(btrim(new.nickname), ''), split_part(new.name, ' ', 1)), 30);
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if new.driver_code is null or btrim(new.driver_code) = '' then
    new.driver_code := public.generate_member_id();
  else
    new.driver_code := upper(btrim(new.driver_code));
  end if;
  return new;
end;
$$;

alter table public.profiles alter column driver_code set not null;

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
    public.generate_member_id(),
    target_team,
    'pending'
  );
  return new;
end;
$$;
