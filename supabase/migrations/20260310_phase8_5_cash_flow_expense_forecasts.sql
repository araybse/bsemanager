create table if not exists public.cash_flow_expense_forecasts (
  forecast_month text primary key,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_flow_expense_forecasts_month_format_check check (forecast_month ~ '^\d{4}-\d{2}$')
);
