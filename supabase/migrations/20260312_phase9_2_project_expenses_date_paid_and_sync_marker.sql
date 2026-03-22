begin;

alter table public.project_expenses
  add column if not exists date_paid date null;

alter table public.qb_settings
  add column if not exists last_expense_sync_at timestamptz null;

commit;

