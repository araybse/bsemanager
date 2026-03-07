begin;

-- Core schedule-of-rates model
create table if not exists public.rate_positions (
  id bigserial primary key,
  code text not null unique,
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_schedules (
  id bigserial primary key,
  year_label integer not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_schedule_items (
  id bigserial primary key,
  schedule_id bigint not null references public.rate_schedules(id) on delete cascade,
  position_id bigint not null references public.rate_positions(id) on delete cascade,
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, position_id)
);

create table if not exists public.project_rate_schedule_assignments (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  schedule_id bigint not null references public.rate_schedules(id) on delete restrict,
  source text not null default 'proposal_default' check (source in ('proposal_default', 'manual_override')),
  set_by uuid null references public.profiles(id) on delete set null,
  set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists public.project_rate_position_overrides (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  position_id bigint not null references public.rate_positions(id) on delete cascade,
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  effective_from date null,
  effective_to date null,
  reason text null,
  set_by uuid null references public.profiles(id) on delete set null,
  set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists ix_project_rate_position_overrides_lookup
  on public.project_rate_position_overrides (project_id, position_id, effective_from, effective_to);

alter table if exists public.profiles
  add column if not exists rate_position_id bigint references public.rate_positions(id) on delete set null;

alter table if exists public.employee_title_history
  add column if not exists rate_position_id bigint references public.rate_positions(id) on delete set null;

-- Schedule/position seeds
insert into public.rate_positions (code, name, sort_order, is_active)
values
  ('PRINCIPAL_ENGINEER', 'Principal Engineer', 10, true),
  ('SENIOR_PROJECT_MANAGER', 'Senior Project Manager', 20, true),
  ('PROJECT_MANAGER', 'Project Manager', 30, true),
  ('PROJECT_ENGINEER', 'Project Engineer', 40, true),
  ('SENIOR_DESIGNER', 'Senior Designer', 50, true),
  ('DESIGNER', 'Designer', 60, true),
  ('SENIOR_TECHNICIAN', 'Senior Technician', 70, true),
  ('TECHNICIAN', 'Technician', 80, true),
  ('PROJECT_INSPECTOR', 'Project Inspector', 90, true)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.rate_schedules (year_label, name, is_active)
values
  (2023, 'Schedule of Rates 2023', true),
  (2024, 'Schedule of Rates 2024', true),
  (2025, 'Schedule of Rates 2025', true),
  (2026, 'Schedule of Rates 2026', true)
on conflict (year_label) do update
set name = excluded.name,
    is_active = excluded.is_active,
    updated_at = now();

with seeded_rates as (
  select 2023::int as year_label, 'Principal Engineer'::text as position_name, 265::numeric(12,2) as hourly_rate union all
  select 2024, 'Principal Engineer', 265 union all
  select 2025, 'Principal Engineer', 275 union all
  select 2026, 'Principal Engineer', 295 union all

  select 2023, 'Senior Project Manager', 200 union all
  select 2024, 'Senior Project Manager', 200 union all
  select 2025, 'Senior Project Manager', 210 union all
  select 2026, 'Senior Project Manager', 225 union all

  select 2023, 'Project Manager', 175 union all
  select 2024, 'Project Manager', 175 union all
  select 2025, 'Project Manager', 185 union all
  select 2026, 'Project Manager', 210 union all

  select 2023, 'Project Engineer', 160 union all
  select 2024, 'Project Engineer', 160 union all
  select 2025, 'Project Engineer', 170 union all
  select 2026, 'Project Engineer', 190 union all

  select 2023, 'Senior Designer', 135 union all
  select 2024, 'Senior Designer', 135 union all
  select 2025, 'Senior Designer', 145 union all
  select 2026, 'Senior Designer', 175 union all

  select 2023, 'Designer', 120 union all
  select 2024, 'Designer', 120 union all
  select 2025, 'Designer', 130 union all
  select 2026, 'Designer', 165 union all

  select 2023, 'Senior Technician', 120 union all
  select 2024, 'Senior Technician', 120 union all
  select 2025, 'Senior Technician', 130 union all
  select 2026, 'Senior Technician', 140 union all

  select 2023, 'Technician', 120 union all
  select 2024, 'Technician', 120 union all
  select 2025, 'Technician', 130 union all
  select 2026, 'Technician', 140 union all

  select 2023, 'Project Inspector', 120 union all
  select 2024, 'Project Inspector', 120 union all
  select 2025, 'Project Inspector', 130 union all
  select 2026, 'Project Inspector', 140
)
insert into public.rate_schedule_items (schedule_id, position_id, hourly_rate)
select rs.id, rp.id, sr.hourly_rate
from seeded_rates sr
join public.rate_schedules rs on rs.year_label = sr.year_label
join public.rate_positions rp on rp.name = sr.position_name
on conflict (schedule_id, position_id) do update
set hourly_rate = excluded.hourly_rate,
    updated_at = now();

-- Backfill profile position mappings from title text.
with normalized_profiles as (
  select
    p.id,
    lower(trim(coalesce(p.title, ''))) as normalized_title
  from public.profiles p
)
update public.profiles p
set rate_position_id = rp.id,
    updated_at = now()
from normalized_profiles np
join public.rate_positions rp
  on rp.name = case
    when np.normalized_title = 'president' then 'Principal Engineer'
    when np.normalized_title = 'sr project manager' then 'Senior Project Manager'
    when np.normalized_title = 'project manager' then 'Project Manager'
    when np.normalized_title = 'project engineer' then 'Project Engineer'
    when np.normalized_title = 'senior designer' then 'Senior Designer'
    when np.normalized_title = 'designer' then 'Designer'
    when np.normalized_title = 'senior technician' then 'Senior Technician'
    when np.normalized_title = 'technician' then 'Technician'
    when np.normalized_title = 'project inspector' then 'Project Inspector'
    else null
  end
where p.id = np.id
  and p.rate_position_id is null;

-- Seed timeline mappings from legacy employee_title_history.title when possible.
with normalized_history as (
  select
    eh.id,
    lower(trim(coalesce(eh.title, ''))) as normalized_title
  from public.employee_title_history eh
)
update public.employee_title_history eh
set rate_position_id = rp.id,
    updated_at = now()
from normalized_history nh
join public.rate_positions rp
  on rp.name = case
    when nh.normalized_title = 'president' then 'Principal Engineer'
    when nh.normalized_title = 'sr project manager' then 'Senior Project Manager'
    when nh.normalized_title = 'project manager' then 'Project Manager'
    when nh.normalized_title = 'project engineer' then 'Project Engineer'
    when nh.normalized_title = 'senior designer' then 'Senior Designer'
    when nh.normalized_title = 'designer' then 'Designer'
    when nh.normalized_title = 'senior technician' then 'Senior Technician'
    when nh.normalized_title = 'technician' then 'Technician'
    when nh.normalized_title = 'project inspector' then 'Project Inspector'
    else null
  end
where eh.id = nh.id
  and eh.rate_position_id is null;

-- Project -> schedule default assignment from linked proposal submitted year.
insert into public.project_rate_schedule_assignments (project_id, schedule_id, source, set_at, created_at, updated_at)
select
  p.id as project_id,
  rs.id as schedule_id,
  'proposal_default'::text as source,
  now(),
  now(),
  now()
from public.projects p
join public.proposals pr on pr.id = p.proposal_id
join public.rate_schedules rs on rs.year_label = extract(year from pr.date_submitted)::int
where pr.date_submitted is not null
on conflict (project_id) do nothing;

-- Proposal number migration to P-YY-## format.
update public.proposals
set proposal_number = 'P-' || proposal_number,
    updated_at = now()
where proposal_number ~ '^[0-9]{2}-[0-9]{2}$';

-- Validate duplicates before enforcing uniqueness.
do $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from (
    select proposal_number
    from public.proposals
    group by proposal_number
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'Duplicate proposal_number values exist after migration; resolve duplicates before enforcing uniqueness.';
  end if;
end $$;

create unique index if not exists ux_proposals_proposal_number
  on public.proposals (proposal_number);

-- RLS / policies for new tables
alter table public.rate_positions enable row level security;
alter table public.rate_schedules enable row level security;
alter table public.rate_schedule_items enable row level security;
alter table public.project_rate_schedule_assignments enable row level security;
alter table public.project_rate_position_overrides enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'rate_positions',
    'rate_schedules',
    'rate_schedule_items',
    'project_rate_schedule_assignments',
    'project_rate_position_overrides'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = 'authenticated_read_' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for select using ((select auth.role()) = %L)',
        'authenticated_read_' || tbl,
        tbl,
        'authenticated'
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = 'authenticated_write_' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for all using ((select auth.role()) = %L) with check ((select auth.role()) = %L)',
        'authenticated_write_' || tbl,
        tbl,
        'authenticated',
        'authenticated'
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = 'service_role_all_' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for all using ((select auth.role()) = %L) with check ((select auth.role()) = %L)',
        'service_role_all_' || tbl,
        tbl,
        'service_role',
        'service_role'
      );
    end if;
  end loop;
end $$;

commit;
