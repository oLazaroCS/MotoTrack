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
    candidate := 'EQP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.teams where join_code = candidate);
  end loop;
  return candidate;
end;
$$;
