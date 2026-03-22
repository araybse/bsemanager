create table if not exists public.cash_flow_project_visibility (
  project_number text primary key,
  is_hidden boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cash_flow_project_visibility_hidden_idx
  on public.cash_flow_project_visibility(is_hidden);
