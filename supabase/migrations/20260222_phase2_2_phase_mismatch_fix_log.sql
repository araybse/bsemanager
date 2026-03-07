begin;

create table if not exists public.data_quality_fix_log (
  id bigserial primary key,
  fix_type text not null check (fix_type in ('phase_mismatch')),
  line_item_id bigint null references public.invoice_line_items(id) on delete set null,
  invoice_number text null,
  project_number text null,
  old_phase_name text null,
  new_phase_name text null,
  changed_by uuid null,
  changed_by_email text null,
  changed_at timestamptz not null default now()
);

create index if not exists ix_data_quality_fix_log_changed_at
  on public.data_quality_fix_log (changed_at desc);

create index if not exists ix_data_quality_fix_log_line_item_id
  on public.data_quality_fix_log (line_item_id);

alter table public.data_quality_fix_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'data_quality_fix_log'
      and policyname = 'authenticated_read_data_quality_fix_log'
  ) then
    create policy authenticated_read_data_quality_fix_log
      on public.data_quality_fix_log
      for select
      using ((select auth.role()) = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'data_quality_fix_log'
      and policyname = 'service_role_all_data_quality_fix_log'
  ) then
    create policy service_role_all_data_quality_fix_log
      on public.data_quality_fix_log
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

commit;
