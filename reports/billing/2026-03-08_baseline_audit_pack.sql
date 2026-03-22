-- Baseline audit pack for billing redesign validation
-- Project ref: lqlyargzteskhsddbjpa
-- Generated on: 2026-03-08 (UTC)

-- 1) Core counts, nulls, distributions, parity checks
with
te as (
  select
    count(*)::bigint as total,
    count(*) filter (where qb_time_id is not null and btrim(qb_time_id) <> '')::bigint as with_qb_time_id,
    count(*) filter (where qb_time_id is null or btrim(qb_time_id) = '')::bigint as without_qb_time_id,
    count(*) filter (where billing_period is null)::bigint as billing_period_null,
    count(*) filter (where entry_date is null)::bigint as entry_date_null,
    coalesce(sum(hours),0)::numeric(14,2) as hours_total,
    coalesce(sum(hours) filter (where qb_time_id is not null and btrim(qb_time_id) <> ''),0)::numeric(14,2) as hours_with_qb_time_id,
    coalesce(sum(hours) filter (where qb_time_id is null or btrim(qb_time_id) = ''),0)::numeric(14,2) as hours_without_qb_time_id
  from public.time_entries
),
tbr as (
  select
    count(*)::bigint as total,
    count(*) filter (where resolved_hourly_rate is null)::bigint as resolved_hourly_rate_null,
    count(*) filter (where coalesce(resolved_hourly_rate,0)=0)::bigint as resolved_hourly_rate_zero_or_null,
    count(*) filter (where resolved_labor_hourly_rate is null)::bigint as resolved_labor_hourly_rate_null,
    count(*) filter (where coalesce(resolved_labor_hourly_rate,0)=0)::bigint as resolved_labor_hourly_rate_zero_or_null,
    count(*) filter (where rate_source is null)::bigint as rate_source_null,
    count(*) filter (where labor_rate_source is null)::bigint as labor_rate_source_null,
    count(distinct time_entry_id)::bigint as distinct_time_entry_ids,
    count(*) filter (where time_entry_id is null)::bigint as time_entry_id_null
  from public.time_entry_bill_rates
),
inv as (
  select
    count(*)::bigint as total,
    count(*) filter (where billing_period is null)::bigint as billing_period_null,
    count(*) filter (where date_issued is not null and billing_period is null)::bigint as date_issued_set_billing_period_null,
    coalesce(sum(amount),0)::numeric(14,2) as amount_total
  from public.invoices
),
ili as (
  select
    count(*)::bigint as total,
    count(*) filter (where source_table is null)::bigint as source_table_null,
    count(*) filter (where source_row_id is null)::bigint as source_row_id_null,
    count(*) filter (where billing_period is null)::bigint as billing_period_null,
    count(*) filter (where time_entry_id is not null)::bigint as linked_time_entries,
    count(*) filter (where project_expense_id is not null)::bigint as linked_project_expenses,
    count(*) filter (where time_entry_id is null and project_expense_id is null)::bigint as unlinked_rows,
    coalesce(sum(amount),0)::numeric(14,2) as amount_total,
    coalesce(sum(hours),0)::numeric(14,2) as hours_total,
    coalesce(sum(labor_cost),0)::numeric(14,2) as labor_cost_total,
    coalesce(sum(profit_amount),0)::numeric(14,2) as profit_amount_total
  from public.invoice_line_items
),
pe as (
  select
    count(*)::bigint as total,
    count(*) filter (where billing_status is null)::bigint as billing_status_null,
    count(*) filter (where status is null)::bigint as status_null,
    count(*) filter (where billing_status = 'invoiced')::bigint as billing_status_invoiced,
    count(*) filter (where invoice_id is not null)::bigint as invoice_id_set,
    count(*) filter (where billing_status = 'invoiced' and invoice_id is null)::bigint as invoiced_without_invoice_id,
    count(*) filter (where billing_status <> 'invoiced' and invoice_id is not null)::bigint as non_invoiced_with_invoice_id
  from public.project_expenses
),
pe_dist as (
  select coalesce(jsonb_agg(jsonb_build_object('billing_status', billing_status, 'count', cnt) order by billing_status), '[]'::jsonb) as billing_status_distribution
  from (
    select coalesce(billing_status, '<null>') as billing_status, count(*)::bigint as cnt
    from public.project_expenses
    group by 1
  ) d
),
ili_source_dist as (
  select coalesce(jsonb_agg(jsonb_build_object('source_table', source_table, 'count', cnt) order by source_table), '[]'::jsonb) as source_table_distribution
  from (
    select coalesce(source_table, '<null>') as source_table, count(*)::bigint as cnt
    from public.invoice_line_items
    group by 1
  ) d
),
meta as (
  select
    to_regclass('public.employee_title_history') is not null as employee_title_history_exists,
    to_regclass('public.employee_position_history') is not null as employee_position_history_exists
)
select jsonb_build_object(
  'generated_at_utc', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'project_ref', 'lqlyargzteskhsddbjpa',
  'time_entries', (select to_jsonb(te) from te),
  'time_entry_bill_rates', (select to_jsonb(tbr) from tbr),
  'invoices', (select to_jsonb(inv) from inv),
  'invoice_line_items', (select to_jsonb(ili) from ili),
  'project_expenses', (select to_jsonb(pe) from pe),
  'distributions', jsonb_build_object(
    'project_expenses_billing_status', (select billing_status_distribution from pe_dist),
    'invoice_line_items_source_table', (select source_table_distribution from ili_source_dist)
  ),
  'parity_checks', jsonb_build_object(
    'tbr_distinct_time_entry_ids_vs_time_entries_total', jsonb_build_object(
      'distinct_time_entry_ids', (select distinct_time_entry_ids from tbr),
      'time_entries_total', (select total from te),
      'difference', (select (te.total - tbr.distinct_time_entry_ids) from te, tbr)
    ),
    'project_expenses_invoiced_vs_invoice_id', jsonb_build_object(
      'billing_status_invoiced', (select billing_status_invoiced from pe),
      'invoice_id_set', (select invoice_id_set from pe),
      'difference', (select (pe.billing_status_invoiced - pe.invoice_id_set) from pe)
    )
  ),
  'compat_objects', (select to_jsonb(meta) from meta)
) as baseline_report;

-- 2) Last ~15 months monthly snapshot
with monthly_te as (
  select
    to_char(date_trunc('month', entry_date), 'YYYY-MM') as month,
    count(*)::bigint as entry_count,
    coalesce(sum(hours),0)::numeric(14,2) as total_hours,
    count(*) filter (where is_billable is true)::bigint as billable_count,
    coalesce(sum(hours) filter (where is_billable is true),0)::numeric(14,2) as billable_hours
  from public.time_entries
  where entry_date >= date_trunc('month', now()) - interval '15 months'
  group by 1
),
monthly_tbr as (
  select
    to_char(date_trunc('month', te.entry_date), 'YYYY-MM') as month,
    count(*)::bigint as rate_rows,
    count(*) filter (where coalesce(tbr.resolved_hourly_rate,0)=0)::bigint as zero_or_null_bill_rate_rows
  from public.time_entry_bill_rates tbr
  join public.time_entries te on te.id = tbr.time_entry_id
  where te.entry_date >= date_trunc('month', now()) - interval '15 months'
  group by 1
),
monthly_inv as (
  select
    to_char(date_trunc('month', date_issued), 'YYYY-MM') as month,
    count(*)::bigint as invoice_count,
    coalesce(sum(amount),0)::numeric(14,2) as invoice_amount
  from public.invoices
  where date_issued >= date_trunc('month', now()) - interval '15 months'
  group by 1
)
select coalesce(jsonb_agg(jsonb_build_object(
  'month', m.month,
  'time_entries', coalesce(te.entry_count,0),
  'time_hours', coalesce(te.total_hours,0),
  'billable_time_entries', coalesce(te.billable_count,0),
  'billable_time_hours', coalesce(te.billable_hours,0),
  'tbr_rows', coalesce(tbr.rate_rows,0),
  'tbr_zero_or_null_bill_rate_rows', coalesce(tbr.zero_or_null_bill_rate_rows,0),
  'invoice_count', coalesce(inv.invoice_count,0),
  'invoice_amount', coalesce(inv.invoice_amount,0)
) order by m.month), '[]'::jsonb) as monthly_15_month_snapshot
from (
  select month from monthly_te
  union
  select month from monthly_tbr
  union
  select month from monthly_inv
) m
left join monthly_te te on te.month = m.month
left join monthly_tbr tbr on tbr.month = m.month
left join monthly_inv inv on inv.month = m.month;
