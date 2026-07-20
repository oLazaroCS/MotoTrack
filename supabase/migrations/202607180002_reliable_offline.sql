drop policy if exists "members read team presence" on public.driver_locations;
create policy "members read team presence" on public.driver_locations
for select to authenticated
using (
  team_id = public.current_team_id()
  and (is_online or user_id = auth.uid() or public.is_team_admin())
);

create or replace function public.set_my_offline()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  stopped_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Sessao nao encontrada';
  end if;

  update public.driver_locations
  set is_online = false,
      last_online_at = stopped_at,
      updated_at = stopped_at
  where user_id = auth.uid();

  return stopped_at;
end;
$$;

revoke all on function public.set_my_offline() from public, anon;
grant execute on function public.set_my_offline() to authenticated;
