begin;

create table if not exists public.engineers (
  id bigserial primary key,
  full_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.engineers (full_name, is_active)
values
  ('Austin T. Ray, P.E.', true),
  ('Wesley K. Koning, P.E.', true),
  ('Austin D. Burke, P.E.', true)
on conflict (full_name) do update
set is_active = excluded.is_active;

update public.project_info
set project_manager = case upper(btrim(coalesce(project_manager, '')))
  when 'AUSTIN RAY' then 'AUSTIN T. RAY, P.E.'
  when 'WESLEY KONING' then 'WESLEY K. KONING, P.E.'
  when 'AUSTIN BURKE' then 'AUSTIN D. BURKE, P.E.'
  else project_manager
end
where project_manager is not null and btrim(project_manager) <> '';

commit;
