begin;

-- ---------------------------------------------------------------------------
-- Phase 7.5 - Canonical project_expenses workflow + subcontract contracts
-- ---------------------------------------------------------------------------

-- 1) Contract tracking table (unlimited contracts/vendors per project).
create table if not exists public.subcontract_contracts (
  id bigserial primary key,
  project_id bigint null references public.projects(id) on delete set null,
  project_number text null,
  vendor_name text not null,
  description text null,
  original_amount numeric(14,2) not null default 0,
  start_date date null,
  end_date date null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontract_contracts_status_check
    check (status in ('active', 'closed', 'cancelled')),
  constraint subcontract_contracts_original_amount_check
    check (original_amount >= 0)
);

create index if not exists idx_subcontract_contracts_project_id
  on public.subcontract_contracts (project_id);

create index if not exists idx_subcontract_contracts_project_number
  on public.subcontract_contracts (project_number);

create index if not exists idx_subcontract_contracts_vendor_name
  on public.subcontract_contracts (vendor_name);

-- 2) Canonical expense linkage + soft-close fields.
alter table public.project_expenses
  add column if not exists subcontract_contract_id bigint null references public.subcontract_contracts(id) on delete set null,
  add column if not exists source_active boolean not null default true,
  add column if not exists source_closed_at timestamptz null,
  add column if not exists source_close_reason text null;

create index if not exists idx_project_expenses_subcontract_contract_id
  on public.project_expenses (subcontract_contract_id);

create index if not exists idx_project_expenses_source_active
  on public.project_expenses (source_active);

-- 3) Contract balance view (paid + outstanding).
create or replace view public.subcontract_contract_balances as
select
  sc.id,
  sc.project_id,
  sc.project_number,
  sc.vendor_name,
  sc.description,
  sc.original_amount,
  sc.start_date,
  sc.end_date,
  sc.status,
  sc.created_at,
  sc.updated_at,
  coalesce(sum(pe.fee_amount) filter (
    where pe.source_active is distinct from false
      and pe.is_reimbursable = false
  ), 0)::numeric(14,2) as paid_to_date,
  (sc.original_amount - coalesce(sum(pe.fee_amount) filter (
    where pe.source_active is distinct from false
      and pe.is_reimbursable = false
  ), 0))::numeric(14,2) as outstanding_amount,
  count(pe.id) filter (
    where pe.source_active is distinct from false
      and pe.is_reimbursable = false
  )::bigint as linked_expense_count
from public.subcontract_contracts sc
left join public.project_expenses pe
  on pe.subcontract_contract_id = sc.id
group by
  sc.id,
  sc.project_id,
  sc.project_number,
  sc.vendor_name,
  sc.description,
  sc.original_amount,
  sc.start_date,
  sc.end_date,
  sc.status,
  sc.created_at,
  sc.updated_at;

commit;
