begin;

-- ---------------------------------------------------------------------------
-- Accounting snapshots (MVP): Profit & Loss snapshots from QuickBooks
-- ---------------------------------------------------------------------------

create table if not exists public.accounting_snapshots (
  id bigserial primary key,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  basis text not null default 'accrual',
  fetched_at timestamptz not null default now(),
  source_run_id bigint null references public.sync_runs(id) on delete set null,
  raw_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_snapshots_report_type_check check (report_type in ('profit_and_loss')),
  constraint accounting_snapshots_basis_check check (basis in ('cash', 'accrual')),
  constraint accounting_snapshots_period_check check (period_end >= period_start)
);

create index if not exists idx_accounting_snapshots_report_period_basis
  on public.accounting_snapshots (report_type, period_start, period_end, basis, fetched_at desc);

create table if not exists public.accounting_snapshot_lines (
  id bigserial primary key,
  snapshot_id bigint not null references public.accounting_snapshots(id) on delete cascade,
  section text null,
  account_name text not null,
  account_ref text null,
  amount numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  depth integer not null default 1,
  is_total boolean not null default false,
  parent_key text null,
  row_key text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_snapshot_lines_snapshot_id
  on public.accounting_snapshot_lines (snapshot_id);

create index if not exists idx_accounting_snapshot_lines_section_sort
  on public.accounting_snapshot_lines (snapshot_id, section, sort_order);

commit;
