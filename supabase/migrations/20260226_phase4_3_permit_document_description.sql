alter table if exists public.permit_required_item_catalog
add column if not exists description text null;
