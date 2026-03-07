begin;

-- Allow authenticated app users to manage employee timeline rows from Settings UI.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_title_history'
      and policyname = 'authenticated_write_employee_title_history'
  ) then
    create policy authenticated_write_employee_title_history
      on public.employee_title_history
      for all
      using ((select auth.role()) = 'authenticated')
      with check ((select auth.role()) = 'authenticated');
  end if;
end $$;

commit;
