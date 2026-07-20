drop policy if exists "members read own team details" on public.teams;
create policy "members read own team details" on public.teams
for select to authenticated
using (id = public.current_team_id());

grant select (id, name, join_code) on public.teams to authenticated;
