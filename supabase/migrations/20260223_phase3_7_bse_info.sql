begin;

create table if not exists public.bse_info (
  id bigserial primary key,
  firm_name text not null,
  firm_address text not null,
  firm_number_and_street text not null,
  firm_city_state_zip text not null,
  firm_city_state text not null,
  firm_city text not null,
  firm_state text not null,
  firm_zip text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_bse_info_firm_name
  on public.bse_info (firm_name);

insert into public.bse_info (
  firm_name,
  firm_address,
  firm_number_and_street,
  firm_city_state_zip,
  firm_city_state,
  firm_city,
  firm_state,
  firm_zip
)
values (
  'Blackstone Engineering',
  '6100 Greenland Road, Suite 903, Jacksonville, FL 32258',
  '6100 Greenland Road, Suite 903',
  'Jacksonville, FL 32258',
  'Jacksonville, FL',
  'Jacksonville',
  'FL',
  '32258'
)
on conflict (firm_name) do update
set
  firm_address = excluded.firm_address,
  firm_number_and_street = excluded.firm_number_and_street,
  firm_city_state_zip = excluded.firm_city_state_zip,
  firm_city_state = excluded.firm_city_state,
  firm_city = excluded.firm_city,
  firm_state = excluded.firm_state,
  firm_zip = excluded.firm_zip,
  updated_at = now();

commit;
