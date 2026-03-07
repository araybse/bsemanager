begin;

create index if not exists ix_project_expense_audit_log_old_project_id
  on public.project_expense_audit_log (old_project_id);

create index if not exists ix_project_expense_audit_log_new_project_id
  on public.project_expense_audit_log (new_project_id);

commit;
