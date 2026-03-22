begin;

-- ---------------------------------------------------------------------------
-- Phase 7.1 - Compatibility-first billing schema expansion
-- ---------------------------------------------------------------------------

-- 1) Invoices: add billing_period without breaking current readers/writers.
alter table public.invoices
  add column if not exists billing_period date;

update public.invoices
set billing_period = date_trunc('month', date_issued)::date
where billing_period is null
  and date_issued is not null;

create index if not exists idx_invoices_project_billing_period
  on public.invoices (project_id, billing_period);

-- 2) Invoice line items: add optional source-link/detail fields.
alter table public.invoice_line_items
  add column if not exists time_entry_id bigint,
  add column if not exists project_expense_id bigint,
  add column if not exists source_table text,
  add column if not exists source_row_id text,
  add column if not exists billing_period date,
  add column if not exists hours numeric,
  add column if not exists billable_rate numeric,
  add column if not exists labor_cost numeric,
  add column if not exists profit_amount numeric;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'invoice_line_items'
      and constraint_name = 'invoice_line_items_time_entry_id_fkey'
  ) then
    alter table public.invoice_line_items
      add constraint invoice_line_items_time_entry_id_fkey
      foreign key (time_entry_id) references public.time_entries(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'invoice_line_items'
      and constraint_name = 'invoice_line_items_project_expense_id_fkey'
  ) then
    alter table public.invoice_line_items
      add constraint invoice_line_items_project_expense_id_fkey
      foreign key (project_expense_id) references public.project_expenses(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'invoice_line_items'
      and constraint_name = 'invoice_line_items_source_table_check'
  ) then
    alter table public.invoice_line_items
      add constraint invoice_line_items_source_table_check
      check (
        source_table is null
        or source_table = any (array['time_entries'::text, 'project_expenses'::text, 'manual'::text, 'qbo'::text])
      );
  end if;
end $$;

create index if not exists idx_invoice_line_items_time_entry_id
  on public.invoice_line_items (time_entry_id);

create index if not exists idx_invoice_line_items_project_expense_id
  on public.invoice_line_items (project_expense_id);

create index if not exists idx_invoice_line_items_billing_period
  on public.invoice_line_items (billing_period);

-- 3) Time-entry bill-rate snapshots: include labor-side snapshots.
alter table public.time_entry_bill_rates
  add column if not exists resolved_labor_hourly_rate numeric,
  add column if not exists labor_rate_source text,
  add column if not exists labor_rate_source_id bigint,
  add column if not exists labor_effective_from_used date;

update public.time_entry_bill_rates tebr
set resolved_labor_hourly_rate = round((te.labor_cost / te.hours)::numeric, 2),
    labor_rate_source = coalesce(tebr.labor_rate_source, 'derived_from_time_entries')
from public.time_entries te
where te.id = tebr.time_entry_id
  and te.hours > 0
  and tebr.resolved_labor_hourly_rate is null
  and te.labor_cost is not null;

-- 4) Project expenses: introduce billing_status while preserving legacy status.
alter table public.project_expenses
  add column if not exists billing_status text;

update public.project_expenses
set billing_status = case lower(coalesce(status, 'pending'))
  when 'invoiced' then 'invoiced'
  when 'paid' then 'paid'
  when 'to_be_invoiced' then 'approved'
  when 'approved' then 'approved'
  when 'not_reimbursable' then 'ignored'
  when 'ignored' then 'ignored'
  else 'pending'
end
where billing_status is null;

update public.project_expenses
set billing_status = 'invoiced'
where invoice_id is not null
  and coalesce(billing_status, 'pending') not in ('invoiced', 'paid');

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'project_expenses'
      and constraint_name = 'project_expenses_billing_status_check'
  ) then
    alter table public.project_expenses
      add constraint project_expenses_billing_status_check
      check (billing_status = any (array['pending'::text, 'approved'::text, 'invoiced'::text, 'paid'::text, 'ignored'::text]));
  end if;
end $$;

create index if not exists idx_project_expenses_billing_status
  on public.project_expenses (billing_status);

-- Dual-write compatibility trigger: keep legacy status synchronized.
create or replace function public.sync_project_expense_status_fields()
returns trigger
language plpgsql
as $$
begin
  -- Derive missing billing_status from legacy status.
  if new.billing_status is null and new.status is not null then
    new.billing_status := case lower(new.status)
      when 'invoiced' then 'invoiced'
      when 'paid' then 'paid'
      when 'to_be_invoiced' then 'approved'
      when 'approved' then 'approved'
      when 'not_reimbursable' then 'ignored'
      when 'ignored' then 'ignored'
      else 'pending'
    end;
  end if;

  -- Derive missing legacy status from billing_status.
  if new.status is null and new.billing_status is not null then
    new.status := case lower(new.billing_status)
      when 'pending' then 'pending'
      when 'approved' then 'to_be_invoiced'
      when 'invoiced' then 'invoiced'
      when 'paid' then 'paid'
      when 'ignored' then 'not_reimbursable'
      else 'pending'
    end;
  end if;

  -- Canonicalize both fields from billing_status if present.
  if new.billing_status is not null then
    new.billing_status := lower(new.billing_status);
    new.status := case new.billing_status
      when 'pending' then 'pending'
      when 'approved' then 'to_be_invoiced'
      when 'invoiced' then 'invoiced'
      when 'paid' then 'paid'
      when 'ignored' then 'not_reimbursable'
      else coalesce(new.status, 'pending')
    end;
  end if;

  if new.invoice_id is not null and new.billing_status in ('pending', 'approved') then
    new.billing_status := 'invoiced';
    new.status := 'invoiced';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_expenses_sync_status_fields on public.project_expenses;
create trigger trg_project_expenses_sync_status_fields
before insert or update on public.project_expenses
for each row
execute function public.sync_project_expense_status_fields();

-- 5) Rename-compatibility shim for planned table rename.
create or replace view public.employee_position_history as
select *
from public.employee_title_history;

commit;
