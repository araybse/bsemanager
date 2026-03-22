begin;

-- Allow accounting snapshots to store balance sheet report snapshots.
alter table public.accounting_snapshots
  drop constraint if exists accounting_snapshots_report_type_check;

alter table public.accounting_snapshots
  add constraint accounting_snapshots_report_type_check
  check (report_type in ('profit_and_loss', 'balance_sheet'));

commit;
