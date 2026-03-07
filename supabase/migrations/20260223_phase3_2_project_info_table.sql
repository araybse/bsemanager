begin;

create table if not exists public.project_info (
  id bigserial primary key,
  project_id bigint not null unique references public.projects(id) on delete cascade,
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

create index if not exists ix_project_info_project_id on public.project_info(project_id);

commit;
