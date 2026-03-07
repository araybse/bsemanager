begin;

-- Tune RLS policy expressions to avoid per-row auth function re-evaluation.

alter policy pm_update_phases
  on public.contract_phases
  using (
    (get_user_role() = 'project_manager'::user_role)
    and exists (
      select 1
      from projects p
      where p.id = contract_phases.project_id
        and p.pm_id = (select auth.uid())
    )
  )
  with check (
    (get_user_role() = 'project_manager'::user_role)
    and exists (
      select 1
      from projects p
      where p.id = contract_phases.project_id
        and p.pm_id = (select auth.uid())
    )
  );

alter policy profiles_update_own
  on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "Authenticated can read submittals"
  on public.project_submittals
  using ((select auth.role()) = 'authenticated');

alter policy "Authenticated can insert submittals"
  on public.project_submittals
  with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated can update submittals"
  on public.project_submittals
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

alter policy service_role_all_memory_documents
  on public.memory_documents
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

commit;
