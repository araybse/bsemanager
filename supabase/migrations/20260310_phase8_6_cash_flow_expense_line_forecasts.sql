create table if not exists public.cash_flow_expense_line_forecasts (
  account_key text not null,
  account_name text not null,
  forecast_month text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_flow_expense_line_forecasts_pk primary key (account_key, forecast_month),
  constraint cash_flow_expense_line_forecasts_month_format_check check (forecast_month ~ '^\d{4}-\d{2}$')
);

create index if not exists cash_flow_expense_line_forecasts_month_idx
  on public.cash_flow_expense_line_forecasts(forecast_month);
