create or replace function public.is_active_team_member()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'active' and team_id is not null
  )
$$;

drop policy if exists "profiles visible by scope" on public.profiles;
create policy "profiles visible by scope" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_master_admin()
  or (
    public.is_active_team_member()
    and team_id is not null
    and team_id = public.current_team_id()
  )
);

drop policy if exists "teams visible by scope" on public.teams;
create policy "teams visible by scope" on public.teams
for select to authenticated
using (
  public.is_master_admin()
  or (public.is_active_team_member() and id = public.current_team_id())
);

drop policy if exists "locations visible by scope" on public.driver_locations;
create policy "locations visible by scope" on public.driver_locations
for select to authenticated
using (
  public.is_master_admin()
  or (
    public.is_active_team_member()
    and team_id = public.current_team_id()
    and (is_online or user_id = auth.uid() or public.is_team_admin())
  )
);

drop policy if exists "scoped avatar reads" on storage.objects;
create policy "scoped avatar reads" on storage.objects
for select to authenticated using (
  bucket_id = 'avatars'
  and (
    public.is_master_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or (
      public.is_active_team_member()
      and exists(
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.team_id = public.current_team_id()
      )
    )
  )
);
