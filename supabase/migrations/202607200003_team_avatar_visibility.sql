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
      or exists (
        select 1
        from public.profiles viewer
        join public.profiles owner
          on owner.id::text = split_part(object_name, '/', 1)
        where viewer.id = auth.uid()
          and viewer.account_status = 'active'
          and (
            viewer.is_master_admin
            or (
              viewer.team_id is not null
              and owner.team_id = viewer.team_id
            )
          )
      )
    )
$$;

revoke all on function public.can_read_team_avatar(text) from public;
grant execute on function public.can_read_team_avatar(text) to authenticated;

drop policy if exists "scoped avatar reads" on storage.objects;
drop policy if exists "team reads avatars" on storage.objects;
create policy "scoped avatar reads" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and public.can_read_team_avatar(name)
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
