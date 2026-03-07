begin;

-- Ensure multiplier view uses caller permissions.
alter view public.project_multiplier_view set (security_invoker = true);

-- Enable RLS on new phase-1 tables.
alter table public.project_expenses enable row level security;
alter table public.employee_title_history enable row level security;
alter table public.proposal_rate_cards enable row level security;
alter table public.time_entry_bill_rates enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_watermarks enable row level security;

-- project_expenses: app users can read/update, service role can do all.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expenses' and policyname = 'authenticated_read_project_expenses'
  ) then
    create policy authenticated_read_project_expenses
      on public.project_expenses
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expenses' and policyname = 'authenticated_update_project_expenses'
  ) then
    create policy authenticated_update_project_expenses
      on public.project_expenses
      for update
      using ((select auth.role()) = 'authenticated')
      with check ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_expenses' and policyname = 'service_role_all_project_expenses'
  ) then
    create policy service_role_all_project_expenses
      on public.project_expenses
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- employee_title_history: read for authenticated, full access for service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'employee_title_history' and policyname = 'authenticated_read_employee_title_history'
  ) then
    create policy authenticated_read_employee_title_history
      on public.employee_title_history
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'employee_title_history' and policyname = 'service_role_all_employee_title_history'
  ) then
    create policy service_role_all_employee_title_history
      on public.employee_title_history
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- proposal_rate_cards: read for authenticated, full access for service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposal_rate_cards' and policyname = 'authenticated_read_proposal_rate_cards'
  ) then
    create policy authenticated_read_proposal_rate_cards
      on public.proposal_rate_cards
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposal_rate_cards' and policyname = 'service_role_all_proposal_rate_cards'
  ) then
    create policy service_role_all_proposal_rate_cards
      on public.proposal_rate_cards
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- time_entry_bill_rates: read for authenticated, full access for service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'time_entry_bill_rates' and policyname = 'authenticated_read_time_entry_bill_rates'
  ) then
    create policy authenticated_read_time_entry_bill_rates
      on public.time_entry_bill_rates
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'time_entry_bill_rates' and policyname = 'service_role_all_time_entry_bill_rates'
  ) then
    create policy service_role_all_time_entry_bill_rates
      on public.time_entry_bill_rates
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- sync_runs: authenticated read for settings screen, full access for service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sync_runs' and policyname = 'authenticated_read_sync_runs'
  ) then
    create policy authenticated_read_sync_runs
      on public.sync_runs
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sync_runs' and policyname = 'service_role_all_sync_runs'
  ) then
    create policy service_role_all_sync_runs
      on public.sync_runs
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- sync_watermarks: service role only.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sync_watermarks' and policyname = 'service_role_all_sync_watermarks'
  ) then
    create policy service_role_all_sync_watermarks
      on public.sync_watermarks
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

commit;
