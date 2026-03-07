begin;

-- Resolve RLS warning on public."BSE.Accounting"
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'BSE.Accounting'
      and policyname = 'service_role_all_bse_accounting'
  ) then
    create policy service_role_all_bse_accounting
      on public."BSE.Accounting"
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- Targeted FK index coverage from advisor results.
create index if not exists ix_action_items_document_id
  on public.action_items (document_id);

create index if not exists ix_billable_rates_employee_id
  on public.billable_rates (employee_id);

create index if not exists ix_contract_labor_project_id
  on public.contract_labor (project_id);

create index if not exists ix_invoice_line_items_invoice_id
  on public.invoice_line_items (invoice_id);

create index if not exists ix_invoices_project_id
  on public.invoices (project_id);

create index if not exists ix_membership_schedule_membership_id
  on public.membership_schedule (membership_id);

create index if not exists ix_project_expenses_project_id
  on public.project_expenses (project_id);

create index if not exists ix_project_permits_project_id
  on public.project_permits (project_id);

create index if not exists ix_projects_client_id
  on public.projects (client_id);

create index if not exists ix_projects_pm_id
  on public.projects (pm_id);

create index if not exists ix_projects_proposal_id
  on public.projects (proposal_id);

create index if not exists ix_proposals_pm_id
  on public.proposals (pm_id);

create index if not exists ix_reimbursables_invoice_id
  on public.reimbursables (invoice_id);

create index if not exists ix_reimbursables_project_id
  on public.reimbursables (project_id);

create index if not exists ix_time_entries_invoice_id
  on public.time_entries (invoice_id);

create index if not exists ix_time_entries_employee_id
  on public.time_entries (employee_id);

commit;
