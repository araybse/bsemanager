alter table if exists public.project_info_field_catalog
  add column if not exists description text;
