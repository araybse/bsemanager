begin;

create table if not exists public.data_quality_runs (
  id bigserial primary key,
  triggered_by uuid null,
  triggered_by_email text null,
  trigger_mode text not null default 'manual',
  phase_mismatch_count integer not null default 0,
  duplicate_candidate_count integer not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_data_quality_runs_created_at
  on public.data_quality_runs (created_at desc);

alter table public.data_quality_runs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'data_quality_runs'
      and policyname = 'authenticated_read_data_quality_runs'
  ) then
    create policy authenticated_read_data_quality_runs
      on public.data_quality_runs
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
      and tablename = 'data_quality_runs'
      and policyname = 'service_role_all_data_quality_runs'
  ) then
    create policy service_role_all_data_quality_runs
      on public.data_quality_runs
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

commit;
