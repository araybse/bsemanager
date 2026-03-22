begin;

-- ---------------------------------------------------------------------------
-- Phase 7.4 - Deterministic linkage for reimbursable invoice line items
-- ---------------------------------------------------------------------------
-- Link invoice_line_items.project_expense_id only when there is exactly one
-- matching project_expenses row by:
--   - project_number
--   - invoice_number
--   - amount_to_charge == line amount (rounded to cents)
-- This avoids ambiguous matches and keeps updates non-destructive.

with candidate_matches as (
  select
    l.id as line_item_id,
    p.id as project_expense_id
  from public.invoice_line_items l
  join public.project_expenses p
    on p.project_number = l.project_number
   and coalesce(p.invoice_number, '') = coalesce(l.invoice_number, '')
   and round(coalesce(p.amount_to_charge, 0)::numeric, 2) = round(coalesce(l.amount, 0)::numeric, 2)
  where lower(coalesce(l.line_type, '')) = 'reimbursable'
    and l.project_expense_id is null
),
unique_candidates as (
  select
    line_item_id,
    max(project_expense_id) as project_expense_id
  from candidate_matches
  group by line_item_id
  having count(*) = 1
)
update public.invoice_line_items l
set project_expense_id = u.project_expense_id
from unique_candidates u
where l.id = u.line_item_id
  and l.project_expense_id is null;

commit;
