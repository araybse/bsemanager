begin;

-- ---------------------------------------------------------------------------
-- Phase 7.2 - Safe compatibility backfills (non-destructive)
-- ---------------------------------------------------------------------------

-- 1) Backfill time_entries.billing_period from entry_date.
update public.time_entries
set billing_period = date_trunc('month', entry_date)::date
where billing_period is null
  and entry_date is not null;

-- 2) Backfill invoice_line_items.billing_period from invoice date context.
update public.invoice_line_items il
set billing_period = coalesce(
  il.billing_period,
  date_trunc('month', inv.date_issued)::date,
  inv.billing_period
)
from public.invoices inv
where il.invoice_id = inv.id
  and il.billing_period is null;

-- 3) Backfill invoice_line_items source metadata for legacy rows.
-- Use conservative defaults:
-- - qbo rows when qb_line_id is present
-- - manual for remaining historical rows with no explicit source
update public.invoice_line_items
set source_table = case
  when qb_line_id is not null then 'qbo'
  else 'manual'
end
where source_table is null;

update public.invoice_line_items
set source_row_id = qb_line_id
where source_row_id is null
  and qb_line_id is not null;

-- 4) Lightweight verification view for quick post-migration checks.
create or replace view public.v_billing_compat_backfill_status as
select
  (select count(*) from public.time_entries where billing_period is null) as time_entries_billing_period_null,
  (select count(*) from public.invoice_line_items where billing_period is null) as invoice_line_items_billing_period_null,
  (select count(*) from public.invoice_line_items where source_table is null) as invoice_line_items_source_table_null,
  (select count(*) from public.invoice_line_items where source_row_id is null and source_table = 'qbo') as qbo_line_items_missing_source_row_id;

commit;
