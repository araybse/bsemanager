create table if not exists public.cash_flow_phase_forecasts (
  id bigserial primary key,
  project_number text not null,
  phase_key text not null,
  phase_name text not null,
  forecast_month text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_flow_phase_forecasts_month_format_check check (forecast_month ~ '^\d{4}-\d{2}$')
);

create unique index if not exists cash_flow_phase_forecasts_unique
  on public.cash_flow_phase_forecasts(project_number, phase_key, forecast_month);

create index if not exists cash_flow_phase_forecasts_project_idx
  on public.cash_flow_phase_forecasts(project_number);

create index if not exists cash_flow_phase_forecasts_month_idx
  on public.cash_flow_phase_forecasts(forecast_month);
