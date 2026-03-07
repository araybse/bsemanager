begin;

-- Backfill contract_labor rows into canonical project_expenses.
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

-- Backfill reimbursables as reimbursable project_expenses rows.
insert into public.project_expenses (
  source_system,
  source_entity_type,
  source_entity_id,
  project_id,
  project_number,
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

commit;
