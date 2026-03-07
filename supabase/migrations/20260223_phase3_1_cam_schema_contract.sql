begin;

-- Workstream A: canonical CAM source registry and shared freshness/audit tables.
create table if not exists public.cam_sources (
  id bigserial primary key,
  source_key text not null unique,
  source_name text not null,
  source_type text not null check (source_type in ('cad_plugin', 'portal_form', 'calc_engine', 'external', 'manual')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cam_projects_ext (
  project_id bigint primary key references public.projects(id) on delete cascade,
  project_number text not null,
  pressure_default_rule text null,
  rollout_cohort text null,
  feature_flags jsonb not null default '{}'::jsonb,
  engineering_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_cam_projects_ext_project_number
  on public.cam_projects_ext (project_number);

create table if not exists public.cam_field_freshness (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  entity_table text not null,
  entity_pk text not null,
  field_name text not null,
  field_value jsonb null,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  losing_sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_table, entity_pk, field_name)
);

create index if not exists ix_cam_field_freshness_project
  on public.cam_field_freshness (project_id, entity_table, sync_state);

create table if not exists public.cam_sync_events (
  id bigserial primary key,
  project_id bigint null references public.projects(id) on delete set null,
  source_system text not null,
  target_system text null,
  entity_table text not null,
  entity_pk text null,
  event_type text not null check (event_type in ('ingest', 'publish', 'reconcile', 'validation')),
  status text not null default 'success' check (status in ('success', 'partial_success', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_summary jsonb null,
  occurred_at timestamptz not null default now()
);

create index if not exists ix_cam_sync_events_project_event
  on public.cam_sync_events (project_id, event_type, occurred_at desc);

create table if not exists public.cam_geometry_refs (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  source_system text not null,
  drawing_key text not null,
  object_handle text not null,
  object_layer text null,
  object_type text null,
  geometry_type text null,
  geometry jsonb not null default '{}'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_system, drawing_key, object_handle)
);

create index if not exists ix_cam_geometry_refs_project_drawing
  on public.cam_geometry_refs (project_id, drawing_key, object_layer);

create table if not exists public.cad_publish_queue (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  target_system text not null,
  drawing_key text not null,
  entity_table text not null,
  entity_pk text not null,
  action text not null check (action in ('upsert', 'delete', 'annotate')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'acked', 'applied', 'failed')),
  queued_at timestamptz not null default now(),
  acked_at timestamptz null,
  applied_at timestamptz null,
  error_message text null
);

create index if not exists ix_cad_publish_queue_pending
  on public.cad_publish_queue (status, project_id, queued_at desc);

-- Drainage domain.
create table if not exists public.drainage_basins (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  basin_code text not null,
  basin_name text not null,
  structure_ref text null,
  area_acres numeric(14,4) not null default 0,
  soil_group text null,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, basin_code)
);

create table if not exists public.drainage_parameters (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  basin_id bigint null references public.drainage_basins(id) on delete cascade,
  parameter_key text not null,
  parameter_value numeric(16,6) null,
  parameter_text text null,
  units text null,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, basin_id, parameter_key)
);

create table if not exists public.drainage_calculations (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  basin_id bigint null references public.drainage_basins(id) on delete cascade,
  calc_type text not null,
  run_id uuid not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  status text not null default 'success' check (status in ('success', 'warning', 'failed')),
  calculated_at timestamptz not null default now(),
  created_by text null
);

create index if not exists ix_drainage_calculations_project_run
  on public.drainage_calculations (project_id, calc_type, calculated_at desc);

create table if not exists public.drainage_model_exchange (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  model_vendor text not null default 'stormwise',
  exchange_direction text not null check (exchange_direction in ('import', 'export')),
  exchange_payload jsonb not null default '{}'::jsonb,
  exchange_hash text null,
  status text not null default 'success' check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

-- Utilities domain.
create table if not exists public.utilities_network_elements (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  network_type text not null check (network_type in ('water', 'sewer', 'pressure', 'fire')),
  element_type text not null,
  element_ref text not null,
  material text null,
  size_label text null,
  length_ft numeric(14,2) null,
  quantity numeric(14,2) null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, network_type, element_type, element_ref)
);

create table if not exists public.utilities_external_letters (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  letter_type text not null check (letter_type in ('pressure_connection', 'hydrant_flow')),
  issuer_name text null,
  letter_date date null,
  reference_number text null,
  values jsonb not null default '{}'::jsonb,
  entered_by text null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.utilities_calculations (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  calc_type text not null check (calc_type in ('lift_station', 'fire_flow')),
  run_id uuid not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  status text not null default 'success' check (status in ('success', 'warning', 'failed')),
  calculated_at timestamptz not null default now(),
  created_by text null
);

create index if not exists ix_utilities_calculations_project_type
  on public.utilities_calculations (project_id, calc_type, calculated_at desc);

create table if not exists public.utilities_model_exchange (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  model_vendor text not null default 'watercad',
  exchange_direction text not null check (exchange_direction in ('import', 'export')),
  exchange_payload jsonb not null default '{}'::jsonb,
  status text not null default 'success' check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

-- CAD quantities domain.
create table if not exists public.cad_base_quantities (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  drawing_key text not null,
  quantity_key text not null,
  quantity_value numeric(16,4) not null default 0,
  units text null,
  source_handle text null,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_cad_base_quantities_identity
  on public.cad_base_quantities (project_id, drawing_key, quantity_key, source_handle);

create table if not exists public.cad_parcel_structure_links (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  parcel_ref text not null,
  parcel_area_sqft numeric(16,2) not null default 0,
  structure_ref text not null,
  is_dynamic boolean not null default true,
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, parcel_ref)
);

-- Crossing domain.
create table if not exists public.crossings (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  crossing_code text not null,
  source_network_a text not null,
  source_network_b text not null,
  source_ref_a text not null,
  source_ref_b text not null,
  x_coord numeric(16,4) not null,
  y_coord numeric(16,4) not null,
  status text not null default 'detected' check (status in ('detected', 'review', 'resolved')),
  updated_at_source timestamptz not null,
  updated_source_system text not null,
  updated_by text null,
  sync_state text not null default 'synced' check (sync_state in ('synced', 'pending_publish', 'conflict', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, crossing_code)
);

create table if not exists public.crossing_geometry (
  id bigserial primary key,
  crossing_id bigint not null references public.crossings(id) on delete cascade,
  gravity_top_elev numeric(14,4) null,
  gravity_bottom_elev numeric(14,4) null,
  pressure_top_elev numeric(14,4) null,
  pressure_bottom_elev numeric(14,4) null,
  finish_grade_elev numeric(14,4) null,
  interpolation_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crossing_results (
  id bigserial primary key,
  crossing_id bigint not null references public.crossings(id) on delete cascade,
  conflict_detected boolean not null default false,
  required_clearance_ft numeric(10,4) null,
  measured_clearance_ft numeric(10,4) null,
  result_status text not null default 'ok' check (result_status in ('ok', 'warning', 'conflict')),
  result_payload jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists public.crossing_edits (
  id bigserial primary key,
  crossing_id bigint not null references public.crossings(id) on delete cascade,
  project_id bigint not null references public.projects(id) on delete cascade,
  edit_payload jsonb not null default '{}'::jsonb,
  reason text null,
  created_by text null,
  created_at timestamptz not null default now()
);

create table if not exists public.cam_reconciliation_runs (
  id bigserial primary key,
  project_id bigint null references public.projects(id) on delete set null,
  run_type text not null default 'validation',
  status text not null default 'success' check (status in ('success', 'warning', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS and common policies for all CAM tables.
do $$
declare
  t text;
  tables text[] := array[
    'cam_sources',
    'cam_projects_ext',
    'cam_field_freshness',
    'cam_sync_events',
    'cam_geometry_refs',
    'cad_publish_queue',
    'drainage_basins',
    'drainage_parameters',
    'drainage_calculations',
    'drainage_model_exchange',
    'utilities_network_elements',
    'utilities_external_letters',
    'utilities_calculations',
    'utilities_model_exchange',
    'cad_base_quantities',
    'cad_parcel_structure_links',
    'crossings',
    'crossing_geometry',
    'crossing_results',
    'crossing_edits',
    'cam_reconciliation_runs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists authenticated_read_%1$s on public.%1$s', t);
    execute format(
      'create policy authenticated_read_%1$s on public.%1$s for select using ((select auth.role()) = ''authenticated'')',
      t
    );
    execute format('drop policy if exists service_role_all_%1$s on public.%1$s', t);
    execute format(
      'create policy service_role_all_%1$s on public.%1$s for all using ((select auth.role()) = ''service_role'') with check ((select auth.role()) = ''service_role'')',
      t
    );
  end loop;
end $$;

commit;
