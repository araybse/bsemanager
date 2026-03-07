begin;

create table if not exists public.city_county_options (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.city_county_options (name, is_active)
values
  ('CITY OF JAX BEACH', true),
  ('CITY OF JACKSONVILLE', true),
  ('CITY OF PALM COAST', true),
  ('CLAY COUNTY', true),
  ('NASSAU COUNTY', true),
  ('PUTNAM COUNTY', true),
  ('ST. JOHNS COUNTY', true)
on conflict (name) do update
set is_active = excluded.is_active;

insert into public.city_county_options (name, is_active)
select distinct upper(btrim(municipality)) as name, true
from public.projects
where municipality is not null and btrim(municipality) <> ''
on conflict (name) do nothing;

insert into public.city_county_options (name, is_active)
select distinct upper(btrim(city_county)) as name, true
from public.project_info
where city_county is not null and btrim(city_county) <> ''
on conflict (name) do nothing;

commit;
