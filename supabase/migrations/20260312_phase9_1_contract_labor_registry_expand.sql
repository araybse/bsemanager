begin;

-- ---------------------------------------------------------------------------
-- Phase 9.1 - Contract labor registry expansion for Contracts + Schedule UX
-- ---------------------------------------------------------------------------

alter table public.subcontract_contracts
  add column if not exists contract_number text null,
  add column if not exists phase_name text null,
  add column if not exists contract_type text not null default 'fixed_total',
  add column if not exists payment_cadence text null,
  add column if not exists monthly_amount numeric(14,2) null,
  add column if not exists hourly_cost_rate numeric(14,2) null,
  add column if not exists planned_monthly_hours numeric(10,2) null,
  add column if not exists term_notes text null;

alter table public.subcontract_contracts
  drop constraint if exists subcontract_contracts_status_check;

alter table public.subcontract_contracts
  add constraint subcontract_contracts_status_check
  check (status in ('draft', 'active', 'on_hold', 'closed', 'cancelled'));

alter table public.subcontract_contracts
  drop constraint if exists subcontract_contracts_contract_type_check;

alter table public.subcontract_contracts
  add constraint subcontract_contracts_contract_type_check
  check (contract_type in ('fixed_monthly', 'fixed_total', 'hourly'));

alter table public.subcontract_contracts
  drop constraint if exists subcontract_contracts_monthly_amount_check;

alter table public.subcontract_contracts
  add constraint subcontract_contracts_monthly_amount_check
  check (monthly_amount is null or monthly_amount >= 0);

alter table public.subcontract_contracts
  drop constraint if exists subcontract_contracts_hourly_cost_rate_check;

alter table public.subcontract_contracts
  add constraint subcontract_contracts_hourly_cost_rate_check
  check (hourly_cost_rate is null or hourly_cost_rate >= 0);

alter table public.subcontract_contracts
  drop constraint if exists subcontract_contracts_planned_monthly_hours_check;

alter table public.subcontract_contracts
  add constraint subcontract_contracts_planned_monthly_hours_check
  check (planned_monthly_hours is null or planned_monthly_hours >= 0);

create unique index if not exists uq_subcontract_contracts_contract_number
  on public.subcontract_contracts (contract_number)
  where contract_number is not null and btrim(contract_number) <> '';

create index if not exists idx_subcontract_contracts_phase_name
  on public.subcontract_contracts (phase_name);

create index if not exists idx_subcontract_contracts_contract_type
  on public.subcontract_contracts (contract_type);

drop view if exists public.subcontract_contract_balances;

create view public.subcontract_contract_balances as
select
  sc.id,
  sc.contract_number,
  sc.project_id,
  sc.project_number,
  sc.phase_name,
  sc.vendor_name,
  sc.description,
  sc.contract_type,
  sc.payment_cadence,
  sc.original_amount,
  sc.monthly_amount,
  sc.hourly_cost_rate,
  sc.planned_monthly_hours,
  sc.term_notes,
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
  )::bigint as linked_expense_count,
  max(pe.expense_date) filter (
    where pe.source_active is distinct from false
      and pe.is_reimbursable = false
  ) as last_invoice_date,
  case
    when sc.status not in ('draft', 'active', 'on_hold') then null
    when sc.contract_type = 'fixed_monthly' then
      case
        when sc.end_date is not null and sc.end_date < date_trunc('month', current_date)::date then null
        else (date_trunc('month', current_date) + interval '1 month')::date
      end
    when sc.contract_type = 'fixed_total' and
      (sc.original_amount - coalesce(sum(pe.fee_amount) filter (
        where pe.source_active is distinct from false
          and pe.is_reimbursable = false
      ), 0)) > 0
    then coalesce(sc.end_date, (date_trunc('month', current_date) + interval '1 month')::date)
    else null
  end as next_due_date
from public.subcontract_contracts sc
left join public.project_expenses pe
  on pe.subcontract_contract_id = sc.id
group by
  sc.id,
  sc.contract_number,
  sc.project_id,
  sc.project_number,
  sc.phase_name,
  sc.vendor_name,
  sc.description,
  sc.contract_type,
  sc.payment_cadence,
  sc.original_amount,
  sc.monthly_amount,
  sc.hourly_cost_rate,
  sc.planned_monthly_hours,
  sc.term_notes,
  sc.start_date,
  sc.end_date,
  sc.status,
  sc.created_at,
  sc.updated_at;

commit;

