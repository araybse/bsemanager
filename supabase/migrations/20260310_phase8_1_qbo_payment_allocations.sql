create table if not exists public.qbo_payments (
  id bigserial primary key,
  qb_payment_id text not null unique,
  payment_number text null,
  payment_date date not null,
  customer_name text null,
  customer_qb_id text null,
  total_amount numeric(14,2) not null default 0,
  unapplied_amount numeric(14,2) not null default 0,
  project_number text null,
  project_name text null,
  last_updated_time timestamptz null,
  raw_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qbo_payments_payment_date_idx on public.qbo_payments(payment_date);
create index if not exists qbo_payments_project_number_idx on public.qbo_payments(project_number);

create table if not exists public.qbo_payment_allocations (
  id bigserial primary key,
  qb_payment_id text not null references public.qbo_payments(qb_payment_id) on delete cascade,
  qb_invoice_id text not null,
  invoice_id bigint null references public.invoices(id) on delete set null,
  invoice_number text null,
  project_number text null,
  project_name text null,
  payment_date date not null,
  applied_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qbo_payment_allocations_applied_amount_check check (applied_amount >= 0)
);

create unique index if not exists qbo_payment_allocations_unique_key
  on public.qbo_payment_allocations(qb_payment_id, qb_invoice_id, invoice_number, payment_date, applied_amount);

create index if not exists qbo_payment_allocations_payment_date_idx
  on public.qbo_payment_allocations(payment_date);

create index if not exists qbo_payment_allocations_project_number_idx
  on public.qbo_payment_allocations(project_number);

create index if not exists qbo_payment_allocations_invoice_id_idx
  on public.qbo_payment_allocations(invoice_id);

alter table public.qb_settings
  add column if not exists last_payment_sync_at timestamptz null;
