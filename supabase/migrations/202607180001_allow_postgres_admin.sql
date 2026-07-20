create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user = 'postgres' then
    new.updated_at := now();
    return new;
  end if;
  if new.id <> old.id or new.team_id <> old.team_id or new.role <> old.role or new.account_status <> old.account_status or new.email <> old.email or new.driver_code <> old.driver_code then
    raise exception 'Campos protegidos do perfil não podem ser alterados';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

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
