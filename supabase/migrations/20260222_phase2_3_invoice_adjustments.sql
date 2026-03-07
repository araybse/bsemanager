begin;

-- Expand invoice_line_items.line_type to include non-service adjustments.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'invoice_line_items'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%line_type%'
  loop
    execute format('alter table public.invoice_line_items drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.invoice_line_items
  add constraint invoice_line_items_line_type_check
  check (
    line_type = any (array['phase'::text, 'reimbursable'::text, 'hourly'::text, 'adjustment'::text])
  );

update public.invoice_line_items
set line_type = 'adjustment'
where coalesce(lower(line_type), 'phase') not in ('reimbursable', 'adjustment')
  and (
    lower(coalesce(phase_name, '')) like '%bounced check%'
    or lower(coalesce(phase_name, '')) like '%returned check%'
    or lower(coalesce(phase_name, '')) like '%nsf%'
    or lower(coalesce(phase_name, '')) like '%non sufficient funds%'
  );

-- Keep multiplier math based on net service revenue (exclude reimbursables and adjustments).
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
invoice_adjustments as (
  select
    il.project_number,
    coalesce(sum(il.amount), 0)::numeric(14,2) as revenue_adjustments
  from public.invoice_line_items il
  where lower(coalesce(il.line_type, '')) = 'adjustment'
     or lower(coalesce(il.phase_name, '')) like '%bounced check%'
     or lower(coalesce(il.phase_name, '')) like '%returned check%'
     or lower(coalesce(il.phase_name, '')) like '%nsf%'
     or lower(coalesce(il.phase_name, '')) like '%non sufficient funds%'
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
  (
    coalesce(it.revenue_gross, 0)
    - coalesce(ir.revenue_reimbursable, 0)
    - coalesce(ia.revenue_adjustments, 0)
  )::numeric(14,2) as revenue_net_services,
  coalesce(lc.cost_bse_labor, 0)::numeric(14,2) as cost_bse_labor,
  coalesce(ec.cost_other_project_expenses, 0)::numeric(14,2) as cost_other_project_expenses,
  (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0))::numeric(14,2) as cost_total_project,
  case
    when (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0)) > 0
      and (
        coalesce(it.revenue_gross, 0)
        - coalesce(ir.revenue_reimbursable, 0)
        - coalesce(ia.revenue_adjustments, 0)
      ) > 0
    then
      (
        coalesce(it.revenue_gross, 0)
        - coalesce(ir.revenue_reimbursable, 0)
        - coalesce(ia.revenue_adjustments, 0)
      )
      / (coalesce(lc.cost_bse_labor, 0) + coalesce(ec.cost_other_project_expenses, 0))
    else null
  end as project_multiplier
from public.projects p
left join invoice_totals it on it.project_number = p.project_number
left join invoice_reimb ir on ir.project_number = p.project_number
left join invoice_adjustments ia on ia.project_number = p.project_number
left join labor_cost lc on lc.project_number = p.project_number
left join expense_cost ec on ec.project_number = p.project_number;

alter view public.project_multiplier_view set (security_invoker = true);

commit;
