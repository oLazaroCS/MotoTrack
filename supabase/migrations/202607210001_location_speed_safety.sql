update public.driver_locations
set speed = 0
where speed is not null
  and (speed < 0 or speed > 80);

alter table public.driver_locations
  drop constraint if exists driver_locations_speed_plausible;

alter table public.driver_locations
  add constraint driver_locations_speed_plausible
  check (speed is null or speed between 0 and 80);
