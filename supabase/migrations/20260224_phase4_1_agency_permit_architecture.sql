create table if not exists public.agency_catalog (
  id bigserial primary key,
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permit_catalog (
  id bigserial primary key,
  agency_id bigint not null references public.agency_catalog(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, code),
  unique (agency_id, name)
);

create table if not exists public.application_template_catalog (
  id bigserial primary key,
  agency_id bigint not null references public.agency_catalog(id) on delete cascade,
  permit_id bigint null references public.permit_catalog(id) on delete set null,
  code text not null,
  name text not null,
  description text null,
  storage_bucket text not null default 'application-templates',
  storage_path text null,
  output_file_name_pattern text not null default '{PROJECT_NUMBER}_{TEMPLATE_CODE}_{YYYYMMDD}.pdf',
  output_mime_type text not null default 'application/pdf',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, code)
);

create table if not exists public.permit_required_item_catalog (
  id bigserial primary key,
  permit_id bigint not null references public.permit_catalog(id) on delete cascade,
  code text not null,
  name text not null,
  item_type text not null default 'document' check (item_type in ('application', 'document', 'plan', 'other')),
  responsibility text not null default 'provided' check (responsibility in ('internal', 'provided', 'shared')),
  default_required boolean not null default true,
  default_notes text null,
  application_template_id bigint null references public.application_template_catalog(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (permit_id, code),
  unique (permit_id, name)
);

create table if not exists public.project_agencies (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  agency_id bigint not null references public.agency_catalog(id) on delete cascade,
  is_selected boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, agency_id)
);

create table if not exists public.project_permit_selections (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  project_agency_id bigint null references public.project_agencies(id) on delete set null,
  permit_id bigint not null references public.permit_catalog(id) on delete cascade,
  permit_identifier text null,
  status text not null default 'required' check (status in ('required', 'in_progress', 'submitted', 'approved', 'rejected', 'cancelled')),
  notes text null,
  is_selected boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, permit_id)
);

create table if not exists public.project_required_items (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  project_permit_selection_id bigint not null references public.project_permit_selections(id) on delete cascade,
  required_item_catalog_id bigint null references public.permit_required_item_catalog(id) on delete set null,
  code text null,
  name text not null,
  item_type text not null default 'document' check (item_type in ('application', 'document', 'plan', 'other')),
  responsibility text not null default 'provided' check (responsibility in ('internal', 'provided', 'shared')),
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'requested', 'received', 'in_progress', 'generated', 'submitted', 'completed', 'waived')),
  source_url text null,
  output_file_url text null,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_permit_selection_id, code, name)
);

create table if not exists public.application_field_map (
  id bigserial primary key,
  template_id bigint not null references public.application_template_catalog(id) on delete cascade,
  pdf_field_name text not null,
  canonical_key text not null,
  transform_rule text null,
  fallback_value text null,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (template_id, pdf_field_name)
);

create table if not exists public.project_application_runs (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  project_permit_selection_id bigint null references public.project_permit_selections(id) on delete set null,
  required_item_id bigint null references public.project_required_items(id) on delete set null,
  template_id bigint null references public.application_template_catalog(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  generated_file_path text null,
  generated_file_url text null,
  resolved_fields jsonb not null default '{}'::jsonb,
  error_message text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.generated_application_files (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  run_id bigint not null references public.project_application_runs(id) on delete cascade,
  template_id bigint null references public.application_template_catalog(id) on delete set null,
  file_name text not null,
  storage_bucket text not null default 'generated-applications',
  storage_path text not null unique,
  public_url text null,
  mime_type text not null default 'application/pdf',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_permit_catalog_agency on public.permit_catalog(agency_id, is_active, sort_order);
create index if not exists idx_project_agencies_project on public.project_agencies(project_id, is_selected);
create index if not exists idx_project_permit_selections_project on public.project_permit_selections(project_id, is_selected, status);
create index if not exists idx_project_required_items_project on public.project_required_items(project_id, project_permit_selection_id, status);
create index if not exists idx_application_field_map_template on public.application_field_map(template_id, sort_order);
create index if not exists idx_project_application_runs_project on public.project_application_runs(project_id, created_at desc);
create index if not exists idx_generated_application_files_project on public.generated_application_files(project_id, created_at desc);

insert into public.agency_catalog (code, name, sort_order)
values
  ('COJ', 'City of Jacksonville', 1),
  ('JEA', 'JEA', 2),
  ('FDOT', 'FDOT', 3),
  ('SJC', 'St. Johns County', 4)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.permit_catalog (agency_id, code, name, description, sort_order)
select a.id, v.code, v.name, v.description, v.sort_order
from public.agency_catalog a
join (
  values
    ('COJ', 'PLAN_APPROVAL', 'PLAN APPROVAL', 'City of Jacksonville plan approval permit', 1),
    ('JEA', 'WATER_CONSTRUCTION', 'JEA Water Construction Permit', 'JEA water permit package', 1),
    ('JEA', 'WASTEWATER_CONSTRUCTION', 'JEA Wastewater Construction Permit', 'JEA wastewater permit package', 2),
    ('FDOT', 'ACCESS', 'FDOT Access Permit', 'FDOT access and connection permit package', 1),
    ('SJC', 'COMM', 'COMM', 'St. Johns County COMM permit', 1),
    ('SJC', 'MDP', 'MDP', 'St. Johns County MDP permit', 2)
) as v(agency_code, code, name, description, sort_order)
  on v.agency_code = a.code
on conflict (agency_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.application_template_catalog (agency_id, permit_id, code, name, description, storage_bucket, storage_path, output_file_name_pattern)
select
  a.id,
  p.id,
  v.code,
  v.name,
  v.description,
  'application-templates',
  null,
  '{PROJECT_NUMBER}_{TEMPLATE_CODE}_{YYYYMMDD}.pdf'
from public.agency_catalog a
join public.permit_catalog p on p.agency_id = a.id
join (
  values
    ('COJ', 'PLAN_APPROVAL', 'COJ_PLAN_APPLICATION', 'COJ Plan Application', 'COJ application template'),
    ('JEA', 'WATER_CONSTRUCTION', 'JEA_WATER_APPLICATION', 'JEA Water Application', 'JEA water application template'),
    ('JEA', 'WASTEWATER_CONSTRUCTION', 'JEA_WW_APPLICATION', 'JEA Wastewater Application', 'JEA wastewater application template'),
    ('FDOT', 'ACCESS', 'FDOT_ACCESS_APPLICATION', 'FDOT Access Application', 'FDOT application template'),
    ('SJC', 'COMM', 'SJC_COMM_APPLICATION', 'SJC COMM Application', 'SJC COMM application template'),
    ('SJC', 'MDP', 'SJC_MDP_APPLICATION', 'SJC MDP Application', 'SJC MDP application template')
) as v(agency_code, permit_code, code, name, description)
  on v.agency_code = a.code and v.permit_code = p.code
on conflict (agency_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  permit_id = excluded.permit_id,
  updated_at = timezone('utc', now());

insert into public.permit_required_item_catalog (
  permit_id,
  code,
  name,
  item_type,
  responsibility,
  default_required,
  application_template_id,
  sort_order
)
select
  p.id,
  v.code,
  v.name,
  v.item_type,
  v.responsibility,
  true,
  t.id,
  v.sort_order
from public.permit_catalog p
left join public.application_template_catalog t on t.permit_id = p.id and t.is_active = true
join (
  values
    ('PLAN_APPROVAL', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('PLAN_APPROVAL', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('PLAN_APPROVAL', 'SUPPORTING_DOCS', 'Supporting Documents', 'document', 'provided', 3),
    ('WATER_CONSTRUCTION', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('WATER_CONSTRUCTION', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('WATER_CONSTRUCTION', 'GEOTECH_REPORT', 'Geotechnical Report', 'document', 'provided', 3),
    ('WASTEWATER_CONSTRUCTION', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('WASTEWATER_CONSTRUCTION', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('WASTEWATER_CONSTRUCTION', 'GEOTECH_REPORT', 'Geotechnical Report', 'document', 'provided', 3),
    ('ACCESS', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('ACCESS', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('ACCESS', 'TRAFFIC_STUDY', 'Traffic Study', 'document', 'provided', 3),
    ('COMM', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('COMM', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('COMM', 'SUPPORTING_DOCS', 'Supporting Documents', 'document', 'provided', 3),
    ('MDP', 'APPLICATION_FORM', 'Application Form', 'application', 'internal', 1),
    ('MDP', 'ENGINEERING_PLANS', 'Engineering Plans', 'plan', 'internal', 2),
    ('MDP', 'SUPPORTING_DOCS', 'Supporting Documents', 'document', 'provided', 3)
) as v(permit_code, code, name, item_type, responsibility, sort_order)
  on v.permit_code = p.code
on conflict (permit_id, code) do update
set
  name = excluded.name,
  item_type = excluded.item_type,
  responsibility = excluded.responsibility,
  application_template_id = excluded.application_template_id,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());
