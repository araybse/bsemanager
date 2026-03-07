-- BSE.Manager Execution Pack - SQL Migration Set
-- Source doc: BACKEND_PRODUCT_SPEC_V2.md
-- Run in phases. Validate in a non-production environment first.

begin;

-- =========================================================
-- Phase 1A - Canonical Expenses Table
-- =========================================================

create table if not exists public.project_expenses (
  id bigserial primary key,
  source_system text not null default 'qbo',
  source_entity_type text null,
  source_entity_id text null,
  source_line_id text null,
  project_id bigint null references public.projects(id) on delete set null,
  project_number text null,
  vendor_name text null,
  expense_date date not null,
  description text null,
  category_name text null,
  sub_category_name text null,
  fee_amount numeric(14,2) not null default 0,
  is_reimbursable boolean not null default false,
  markup_pct numeric(7,4) not null default 0.1500,
  amount_to_charge numeric(14,2) generated always as (
    case
      when is_reimbursable then round((fee_amount * (1 + markup_pct))::numeric, 2)
      else 0
    end
  ) stored,
  status text not null default 'pending',
  invoice_id bigint null references public.invoices(id) on delete set null,
  invoice_number text null,
  date_invoiced date null,
  qbo_last_updated_at timestamptz null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_project_expenses_external_key
  on public.project_expenses (source_system, source_entity_type, source_entity_id, source_line_id)
  where source_entity_id is not null;

create index if not exists ix_project_expenses_project_date
  on public.project_expenses (project_number, expense_date);

create index if not exists ix_project_expenses_status_reimbursable
  on public.project_expenses (status, is_reimbursable);

create index if not exists ix_project_expenses_invoice
  on public.project_expenses (invoice_id);

-- =========================================================
-- Phase 1B - Rate Resolution Tables
-- =========================================================

create table if not exists public.employee_title_history (
  id bigserial primary key,
  employee_id text not null,
  employee_name text not null,
  title text not null,
  effective_from date not null,
  effective_to date null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_employee_title_history_lookup
  on public.employee_title_history (employee_id, effective_from desc);

create table if not exists public.proposal_rate_cards (
  id bigserial primary key,
  proposal_id bigint not null references public.proposals(id) on delete cascade,
  project_id bigint null references public.projects(id) on delete set null,
  position_title text not null,
  hourly_rate numeric(12,2) not null,
  effective_from date not null,
  effective_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_proposal_rate_cards_proposal_title
  on public.proposal_rate_cards (proposal_id, position_title, effective_from desc);

create index if not exists ix_proposal_rate_cards_project_title
  on public.proposal_rate_cards (project_id, position_title, effective_from desc);

create table if not exists public.time_entry_bill_rates (
  time_entry_id bigint primary key references public.time_entries(id) on delete cascade,
  employee_id text null,
  employee_name text not null,
  resolved_title text not null,
  resolved_hourly_rate numeric(12,2) not null,
  rate_source text not null default 'proposal_rate_cards',
  rate_source_id bigint null,
  effective_from_used date null,
  resolved_at timestamptz not null default now()
);

-- =========================================================
-- Phase 1C - Sync Observability Tables
-- =========================================================

create table if not exists public.sync_runs (
  id bigserial primary key,
  domain text not null,
  trigger_mode text not null default 'manual',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'success',
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  deleted_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  request_payload jsonb null,
  error_summary jsonb null
);

create index if not exists ix_sync_runs_domain_started
  on public.sync_runs (domain, started_at desc);

create table if not exists public.sync_watermarks (
  domain text primary key,
  last_successful_qbo_updated_at timestamptz null,
  last_successful_cursor text null,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Phase 1D - Compatibility View for Multiplier
-- =========================================================

create or replace view public.project_multiplier_view as
with invoice_totals as (
  select
    i.project_number,
    coalesce(sum(i.amount), 0)::numeric(14,2) as revenue_gross
  from public.invoices i
  group by i.project_number
),
invoice_reimb as (
  select
    il.project_number,
    coalesce(sum(il.amount), 0)::numeric(14,2) as revenue_reimbursable
  from public.invoice_line_items il
  where lower(coalesce(il.phase_name, '')) like '%reimb%'
     or lower(coalesce(il.line_type, '')) = 'reimbursable'
  group by il.project_number
),
labor_cost as (
  select
    te.project_number,
    coalesce(sum(te.labor_cost), 0)::numeric(14,2) as cost_bse_labor
  from public.time_entries te
  where lower(coalesce(te.employee_name, '')) <> 'morgan wilson'
  group by te.project_number
),
expense_cost as (
  select
    pe.project_number,
    coalesce(sum(pe.fee_amount), 0)::numeric(14,2) as cost_other_project_expenses
  from public.project_expenses pe
  where coalesce(pe.is_reimbursable, false) = false
  group by pe.project_number
)
select
  p.id as project_id,
  p.project_number,
  coalesce(it.revenue_gross, 0)::numeric(14,2) as revenue_gross,
  coalesce(ir.revenue_reimbursable, 0)::numeric(14,2) as revenue_reimbursable,
  (coalesce(it.revenue_gross, 0) - coalesce(ir.revenue_reimbursable, 0))::numeric(14,2) as revenue_net_services,
  coalesce(lc.cost_bse_labor, 0)::numeric(14,2) as cost_bse_labor,
  coalesce(ec.cost_other_project_expenses, 0)::numeric(14,2) as cost_other_project_expenses,
  (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0))::numeric(14,2) as cost_total_project,
  case
    when (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0)) > 0
      and (coalesce(it.revenue_gross, 0) - coalesce(ir.revenue_reimbursable, 0)) > 0
    then
      (coalesce(it.revenue_gross, 0) - coalesce(ir.revenue_reimbursable, 0))
      / (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0))
    else null
  end as project_multiplier
from public.projects p
left join invoice_totals it on it.project_number = p.project_number
left join invoice_reimb ir on ir.project_number = p.project_number
left join labor_cost lc on lc.project_number = p.project_number
left join expense_cost ec on ec.project_number = p.project_number;

commit;

-- =========================================================
-- Optional backfill from existing tables into project_expenses
-- =========================================================
-- Insert contract labor history
insert into public.project_expenses (
  source_system,
  source_entity_type,
  source_entity_id,
  project_id,
  project_number,
  vendor_name,
  expense_date,
  description,
  category_name,
  fee_amount,
  is_reimbursable,
  status,
  last_synced_at,
  qbo_last_updated_at
)
select
  'qbo',
  'contract_labor',
  cl.qb_expense_id,
  cl.project_id,
  cl.project_number,
  cl.vendor_name,
  coalesce(cl.payment_date, make_date(cl.year, cl.month, 1)),
  cl.description,
  'Contract Labor',
  cl.amount,
  false,
  'pending',
  cl.last_synced_at,
  cl.updated_at
from public.contract_labor cl
where not exists (
  select 1
  from public.project_expenses pe
  where pe.source_system = 'qbo'
    and pe.source_entity_type = 'contract_labor'
    and pe.source_entity_id = cl.qb_expense_id
);

-- Insert reimbursables history as expenses
insert into public.project_expenses (
  source_system,
  source_entity_type,
  source_entity_id,
  project_id,
  project_number,
  vendor_name,
  expense_date,
  description,
  category_name,
  fee_amount,
  is_reimbursable,
  markup_pct,
  status,
  invoice_id,
  invoice_number,
  date_invoiced
)
select
  'manual',
  'reimbursable_legacy',
  r.id::text,
  r.project_id,
  r.project_number,
  null,
  r.date_charged,
  r.fee_description,
  'Reimbursable',
  r.fee_amount,
  true,
  coalesce(r.markup_pct, 0.15),
  case when r.invoice_id is null then 'pending' else 'invoiced' end,
  r.invoice_id,
  r.invoice_number,
  r.date_invoiced
from public.reimbursables r
where not exists (
  select 1
  from public.project_expenses pe
  where pe.source_system = 'manual'
    and pe.source_entity_type = 'reimbursable_legacy'
    and pe.source_entity_id = r.id::text
);
