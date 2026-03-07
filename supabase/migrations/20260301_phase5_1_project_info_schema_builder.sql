begin;

create table if not exists public.project_info_section_catalog (
  id bigserial primary key,
  code text not null unique,
  title text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_info_field_catalog (
  id bigserial primary key,
  section_id bigint not null references public.project_info_section_catalog(id) on delete cascade,
  label text not null,
  column_name text not null,
  canonical_key text generated always as ('projectInfo.' || column_name) stored,
  input_type text not null default 'text',
  source_type text null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_info_field_catalog_input_type_check
    check (input_type in ('text', 'textarea', 'select', 'date', 'phone', 'number')),
  constraint project_info_field_catalog_source_type_check
    check (source_type is null or source_type in ('static', 'project_managers', 'engineers', 'city_county')),
  constraint project_info_field_catalog_column_name_check
    check (column_name ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint project_info_field_catalog_section_label_unique unique (section_id, label),
  constraint project_info_field_catalog_column_name_unique unique (column_name)
);

create table if not exists public.project_info_field_option_catalog (
  id bigserial primary key,
  field_id bigint not null references public.project_info_field_catalog(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_info_field_option_unique unique (field_id, value)
);

create index if not exists ix_project_info_section_catalog_active_sort
  on public.project_info_section_catalog(is_active, sort_order, id);

create index if not exists ix_project_info_field_catalog_section_active_sort
  on public.project_info_field_catalog(section_id, is_active, sort_order, id);

create index if not exists ix_project_info_field_option_catalog_field_active_sort
  on public.project_info_field_option_catalog(field_id, is_active, sort_order, id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_project_info_section_catalog_updated_at on public.project_info_section_catalog;
create trigger trg_project_info_section_catalog_updated_at
before update on public.project_info_section_catalog
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_project_info_field_catalog_updated_at on public.project_info_field_catalog;
create trigger trg_project_info_field_catalog_updated_at
before update on public.project_info_field_catalog
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_project_info_field_option_catalog_updated_at on public.project_info_field_option_catalog;
create trigger trg_project_info_field_option_catalog_updated_at
before update on public.project_info_field_option_catalog
for each row execute function public.set_updated_at_timestamp();

create or replace function public.add_project_info_column(p_column_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_column text;
begin
  normalized_column := lower(btrim(coalesce(p_column_name, '')));
  if normalized_column = '' then
    raise exception 'Column name is required';
  end if;
  if normalized_column !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'Invalid column identifier: %', normalized_column;
  end if;

  execute format(
    'alter table public.project_info add column if not exists %I text null',
    normalized_column
  );
end;
$$;

revoke all on function public.add_project_info_column(text) from public;
grant execute on function public.add_project_info_column(text) to service_role;

insert into public.project_info_section_catalog (code, title, sort_order, is_active)
values
  ('general', 'General', 10, true),
  ('coj', 'COJ', 20, true),
  ('jea', 'JEA', 30, true),
  ('fdot', 'FDOT', 40, true)
on conflict (code) do update
set
  title = excluded.title,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

with seed_rows as (
  select *
  from jsonb_to_recordset(
    '[
      {"section":"general","label":"Project Number","column_name":"project_number","input_type":"text","source_type":null,"sort_order":10},
      {"section":"general","label":"Project Name","column_name":"project_name","input_type":"text","source_type":null,"sort_order":20},
      {"section":"general","label":"Project Manager","column_name":"project_manager","input_type":"select","source_type":"project_managers","sort_order":30},
      {"section":"general","label":"Project Engineer","column_name":"project_engineer","input_type":"select","source_type":"engineers","sort_order":40},
      {"section":"general","label":"Client","column_name":"client_name","input_type":"text","source_type":null,"sort_order":50},
      {"section":"general","label":"Developer Address (Line 1)","column_name":"client_address_line_1","input_type":"text","source_type":null,"sort_order":60},
      {"section":"general","label":"Developer Address (Line 2)","column_name":"client_address_line_2","input_type":"text","source_type":null,"sort_order":70},
      {"section":"general","label":"Developer Phone","column_name":"client_phone","input_type":"phone","source_type":null,"sort_order":80},
      {"section":"general","label":"Project Date","column_name":"project_date","input_type":"date","source_type":null,"sort_order":90},
      {"section":"general","label":"Availability #","column_name":"availability_number","input_type":"text","source_type":null,"sort_order":100},
      {"section":"general","label":"City/County","column_name":"city_county","input_type":"select","source_type":"city_county","sort_order":110},
      {"section":"general","label":"Engineer Name","column_name":"project_engineer","input_type":"select","source_type":"engineers","sort_order":120},
      {"section":"general","label":"PE #","column_name":"pe_number","input_type":"text","source_type":null,"sort_order":130},
      {"section":"general","label":"Engineer Email","column_name":"engineer_email","input_type":"text","source_type":null,"sort_order":140},
      {"section":"general","label":"Engineer Phone","column_name":"engineer_phone","input_type":"phone","source_type":null,"sort_order":150},
      {"section":"general","label":"Date","column_name":"engineer_date","input_type":"date","source_type":null,"sort_order":160},
      {"section":"general","label":"Major Access","column_name":"major_access","input_type":"text","source_type":null,"sort_order":170},
      {"section":"general","label":"Future Land Use","column_name":"future_land_use","input_type":"text","source_type":null,"sort_order":180},
      {"section":"general","label":"Present Use of Property","column_name":"present_use_of_property","input_type":"text","source_type":null,"sort_order":190},
      {"section":"general","label":"Building SQFT","column_name":"building_sqft","input_type":"text","source_type":null,"sort_order":200},
      {"section":"general","label":"Project Description","column_name":"project_description","input_type":"textarea","source_type":null,"sort_order":210},

      {"section":"coj","label":"Developer Name","column_name":"developer_name","input_type":"text","source_type":null,"sort_order":10},
      {"section":"coj","label":"Owner Name","column_name":"owner_name","input_type":"text","source_type":null,"sort_order":20},
      {"section":"coj","label":"Corporate Title","column_name":"corporate_title","input_type":"text","source_type":null,"sort_order":30},
      {"section":"coj","label":"Owner Address","column_name":"owner_address","input_type":"text","source_type":null,"sort_order":40},
      {"section":"coj","label":"Owner # and Street","column_name":"owner_number_and_street","input_type":"text","source_type":null,"sort_order":50},
      {"section":"coj","label":"Owner City, State, Zip","column_name":"owner_city_state_zip","input_type":"text","source_type":null,"sort_order":60},
      {"section":"coj","label":"Owner City, State","column_name":"owner_city_state","input_type":"text","source_type":null,"sort_order":70},
      {"section":"coj","label":"Owner City","column_name":"owner_city","input_type":"text","source_type":null,"sort_order":80},
      {"section":"coj","label":"Owner State","column_name":"owner_state","input_type":"text","source_type":null,"sort_order":90},
      {"section":"coj","label":"Owner Zip","column_name":"owner_zip","input_type":"text","source_type":null,"sort_order":100},
      {"section":"coj","label":"Owner Email","column_name":"owner_email","input_type":"text","source_type":null,"sort_order":110},
      {"section":"coj","label":"Owner Phone","column_name":"owner_phone","input_type":"phone","source_type":null,"sort_order":120},
      {"section":"coj","label":"Project Address","column_name":"project_address","input_type":"text","source_type":null,"sort_order":130},
      {"section":"coj","label":"Project #","column_name":"project_ref_number","input_type":"text","source_type":null,"sort_order":140},
      {"section":"coj","label":"Project # and Street","column_name":"project_number_and_street","input_type":"text","source_type":null,"sort_order":150},
      {"section":"coj","label":"Project City, State, Zip","column_name":"project_city_state_zip","input_type":"text","source_type":null,"sort_order":160},
      {"section":"coj","label":"Project Street, City, State, Zip","column_name":"project_street_city_state_zip","input_type":"text","source_type":null,"sort_order":170},
      {"section":"coj","label":"Section","column_name":"section","input_type":"text","source_type":null,"sort_order":180},
      {"section":"coj","label":"Township","column_name":"township","input_type":"text","source_type":null,"sort_order":190},
      {"section":"coj","label":"Range","column_name":"range","input_type":"text","source_type":null,"sort_order":200},
      {"section":"coj","label":"Between Streets","column_name":"between_streets","input_type":"text","source_type":null,"sort_order":210},
      {"section":"coj","label":"Council District","column_name":"council_district","input_type":"text","source_type":null,"sort_order":220},
      {"section":"coj","label":"Planning District","column_name":"planning_district","input_type":"text","source_type":null,"sort_order":230},
      {"section":"coj","label":"Census Tract","column_name":"census_tract","input_type":"text","source_type":null,"sort_order":240},
      {"section":"coj","label":"Zoning","column_name":"zoning","input_type":"text","source_type":null,"sort_order":250},
      {"section":"coj","label":"PUD Ordinance","column_name":"pud_ordinance","input_type":"text","source_type":null,"sort_order":260},
      {"section":"coj","label":"Mobility Zone","column_name":"mobility_zone","input_type":"text","source_type":null,"sort_order":270},
      {"section":"coj","label":"Panel Number","column_name":"panel_number","input_type":"text","source_type":null,"sort_order":280},
      {"section":"coj","label":"RE Numbers","column_name":"re_numbers","input_type":"text","source_type":null,"sort_order":290},
      {"section":"coj","label":"Transportation Land Use Code","column_name":"transportation_land_use_code","input_type":"text","source_type":null,"sort_order":300},
      {"section":"coj","label":"Previous Land Use Code","column_name":"previous_land_use_code","input_type":"text","source_type":null,"sort_order":310},
      {"section":"coj","label":"Total Land Area","column_name":"total_land_area","input_type":"text","source_type":null,"sort_order":320},
      {"section":"coj","label":"Developed Land Area","column_name":"developed_land_area","input_type":"text","source_type":null,"sort_order":330},
      {"section":"coj","label":"Total Units","column_name":"total_units","input_type":"number","source_type":null,"sort_order":340},
      {"section":"coj","label":"Single Family Units","column_name":"single_family_units","input_type":"number","source_type":null,"sort_order":350},
      {"section":"coj","label":"Duplex Units","column_name":"duplex_units","input_type":"number","source_type":null,"sort_order":360},
      {"section":"coj","label":"Apartment Units","column_name":"apartment_units","input_type":"number","source_type":null,"sort_order":370},
      {"section":"coj","label":"Mobile Home Units","column_name":"mobile_home_units","input_type":"number","source_type":null,"sort_order":380},
      {"section":"coj","label":"Condo Units","column_name":"condo_units","input_type":"number","source_type":null,"sort_order":390},
      {"section":"coj","label":"Number of Parking Spaces","column_name":"number_of_parking_spaces","input_type":"number","source_type":null,"sort_order":400},
      {"section":"coj","label":"Major Access","column_name":"major_access","input_type":"text","source_type":null,"sort_order":410},
      {"section":"coj","label":"Future Land Use","column_name":"future_land_use","input_type":"text","source_type":null,"sort_order":420},
      {"section":"coj","label":"Present Use of Property","column_name":"present_use_of_property","input_type":"text","source_type":null,"sort_order":430},
      {"section":"coj","label":"Building SQFT","column_name":"building_sqft","input_type":"text","source_type":null,"sort_order":440},
      {"section":"coj","label":"Project Description","column_name":"project_description","input_type":"textarea","source_type":null,"sort_order":450},

      {"section":"jea","label":"JEA Water Construction Permit #","column_name":"jea_water_construction_permit_number","input_type":"text","source_type":null,"sort_order":10},
      {"section":"jea","label":"JEA Wastewater Construction Permit #","column_name":"jea_wastewater_construction_permit_number","input_type":"text","source_type":null,"sort_order":20},
      {"section":"jea","label":"JEA Water Construction Permit Date","column_name":"jea_water_construction_permit_date","input_type":"date","source_type":null,"sort_order":30},
      {"section":"jea","label":"JEA Wastewater Construction Permit Date","column_name":"jea_wastewater_construction_permit_date","input_type":"date","source_type":null,"sort_order":40},
      {"section":"jea","label":"Contractor Name","column_name":"contractor_name","input_type":"text","source_type":null,"sort_order":50},
      {"section":"jea","label":"Contractor Phone","column_name":"contractor_phone","input_type":"phone","source_type":null,"sort_order":60},
      {"section":"jea","label":"Lift Station Address","column_name":"lift_station_address","input_type":"text","source_type":null,"sort_order":70},
      {"section":"jea","label":"Lift Station Meter Number","column_name":"lift_station_meter_number","input_type":"text","source_type":null,"sort_order":80},

      {"section":"fdot","label":"Permit No.","column_name":"permit_number","input_type":"text","source_type":null,"sort_order":10},
      {"section":"fdot","label":"Section No.","column_name":"section_number","input_type":"text","source_type":null,"sort_order":20},
      {"section":"fdot","label":"State Road","column_name":"state_road","input_type":"text","source_type":null,"sort_order":30},
      {"section":"fdot","label":"County","column_name":"county","input_type":"text","source_type":null,"sort_order":40},
      {"section":"fdot","label":"Government Development Review","column_name":"government_development_review","input_type":"text","source_type":null,"sort_order":50},
      {"section":"fdot","label":"Reviewer Name","column_name":"reviewer_name","input_type":"text","source_type":null,"sort_order":60},
      {"section":"fdot","label":"Reviewer Phone","column_name":"reviewer_phone","input_type":"phone","source_type":null,"sort_order":70},
      {"section":"fdot","label":"Reviewer Position","column_name":"reviewer_position","input_type":"text","source_type":null,"sort_order":80},
      {"section":"fdot","label":"Business Type","column_name":"business_type","input_type":"text","source_type":null,"sort_order":90},
      {"section":"fdot","label":"Commercial SQFT","column_name":"commercial_sqft","input_type":"text","source_type":null,"sort_order":100},
      {"section":"fdot","label":"Residential Type","column_name":"residential_type","input_type":"text","source_type":null,"sort_order":110},
      {"section":"fdot","label":"Number of Units","column_name":"number_of_units","input_type":"number","source_type":null,"sort_order":120},
      {"section":"fdot","label":"Daily Traffic Estimate","column_name":"daily_traffic_estimate","input_type":"text","source_type":null,"sort_order":130},
      {"section":"fdot","label":"ITE Land Use Code","column_name":"ite_land_use_code","input_type":"text","source_type":null,"sort_order":140},
      {"section":"fdot","label":"Independent Variables","column_name":"independent_variables","input_type":"text","source_type":null,"sort_order":150},
      {"section":"fdot","label":"ITE Report page # reference","column_name":"ite_report_page_reference","input_type":"text","source_type":null,"sort_order":160},
      {"section":"fdot","label":"Street Name","column_name":"street_name","input_type":"text","source_type":null,"sort_order":170},
      {"section":"fdot","label":"State Road #","column_name":"state_road_number","input_type":"text","source_type":null,"sort_order":180},
      {"section":"fdot","label":"US Highway #","column_name":"us_highway_number","input_type":"text","source_type":null,"sort_order":190},
      {"section":"fdot","label":"Latitude","column_name":"latitude","input_type":"text","source_type":null,"sort_order":200},
      {"section":"fdot","label":"Longitude","column_name":"longitude","input_type":"text","source_type":null,"sort_order":210},
      {"section":"fdot","label":"Benchmark Hor Datum","column_name":"benchmark_hor_datum","input_type":"text","source_type":null,"sort_order":220},
      {"section":"fdot","label":"State Plane Northing","column_name":"state_plane_northing","input_type":"text","source_type":null,"sort_order":230},
      {"section":"fdot","label":"State Plane Easting","column_name":"state_plane_easting","input_type":"text","source_type":null,"sort_order":240},
      {"section":"fdot","label":"Desc Of Facility and Connection","column_name":"desc_of_facility_and_connection","input_type":"textarea","source_type":null,"sort_order":250},
      {"section":"fdot","label":"Desc For needing permit","column_name":"desc_for_needing_permit","input_type":"textarea","source_type":null,"sort_order":260}
    ]'::jsonb
  ) as t(section text, label text, column_name text, input_type text, source_type text, sort_order integer)
),
deduped_seed_rows as (
  select distinct on (column_name)
    section,
    label,
    column_name,
    input_type,
    source_type,
    sort_order
  from seed_rows
  order by column_name, sort_order
)
insert into public.project_info_field_catalog (
  section_id,
  label,
  column_name,
  input_type,
  source_type,
  sort_order,
  is_active,
  is_system
)
select
  s.id,
  r.label,
  r.column_name,
  r.input_type,
  r.source_type,
  r.sort_order,
  true,
  true
from deduped_seed_rows r
join public.project_info_section_catalog s on s.code = r.section
on conflict (column_name) do update
set
  section_id = excluded.section_id,
  label = excluded.label,
  input_type = excluded.input_type,
  source_type = excluded.source_type,
  sort_order = excluded.sort_order,
  is_active = true,
  is_system = true;

with cols as (
  select column_name
  from public.project_info_field_catalog
)
select public.add_project_info_column(column_name) from cols;

commit;
