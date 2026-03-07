begin;

create table if not exists public.project_info_reordered (
  id bigserial primary key,
  project_id bigint not null unique references public.projects(id) on delete cascade,
  project_number text null,
  project_name text null,
  client_name text null,
  client_address_line_1 text null,
  client_address_line_2 text null,
  client_phone text null,
  project_date text null,
  availability_number text null,
  project_manager text null,
  city_county text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.project_info_reordered (
  id,
  project_id,
  project_number,
  project_name,
  client_name,
  client_address_line_1,
  client_address_line_2,
  client_phone,
  project_date,
  availability_number,
  project_manager,
  city_county,
  created_at,
  updated_at
)
select
  id,
  project_id,
  project_number,
  project_name,
  client_name,
  client_address_line_1,
  client_address_line_2,
  client_phone,
  project_date,
  availability_number,
  project_manager,
  city_county,
  created_at,
  updated_at
from public.project_info
on conflict (project_id) do update set
  project_number = excluded.project_number,
  project_name = excluded.project_name,
  client_name = excluded.client_name,
  client_address_line_1 = excluded.client_address_line_1,
  client_address_line_2 = excluded.client_address_line_2,
  client_phone = excluded.client_phone,
  project_date = excluded.project_date,
  availability_number = excluded.availability_number,
  project_manager = excluded.project_manager,
  city_county = excluded.city_county,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

select setval(
  pg_get_serial_sequence('public.project_info_reordered', 'id'),
  coalesce((select max(id) from public.project_info_reordered), 1),
  true
);

drop table public.project_info;
alter table public.project_info_reordered rename to project_info;

create index if not exists ix_project_info_project_id on public.project_info(project_id);

commit;
