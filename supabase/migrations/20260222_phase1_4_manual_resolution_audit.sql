begin;

create table if not exists public.project_expense_audit_log (
  id bigserial primary key,
  expense_id bigint null references public.project_expenses(id) on delete set null,
  source_entity_type text null,
  source_entity_id text null,
  action text not null check (action in ('link', 'reassign', 'unlink')),
  old_project_id bigint null references public.projects(id) on delete set null,
  old_project_number text null,
  new_project_id bigint null references public.projects(id) on delete set null,
  new_project_number text null,
  changed_by uuid null,
  changed_by_email text null,
  notes text null,
  changed_at timestamptz not null default now()
);

create index if not exists ix_project_expense_audit_log_expense_changed_at
  on public.project_expense_audit_log (expense_id, changed_at desc);

alter table public.project_expense_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expense_audit_log' and policyname = 'authenticated_read_project_expense_audit_log'
  ) then
    create policy authenticated_read_project_expense_audit_log
      on public.project_expense_audit_log
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expense_audit_log' and policyname = 'authenticated_insert_project_expense_audit_log'
  ) then
    create policy authenticated_insert_project_expense_audit_log
      on public.project_expense_audit_log
      for insert
      with check ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expense_audit_log' and policyname = 'service_role_all_project_expense_audit_log'
  ) then
    create policy service_role_all_project_expense_audit_log
      on public.project_expense_audit_log
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

commit;
