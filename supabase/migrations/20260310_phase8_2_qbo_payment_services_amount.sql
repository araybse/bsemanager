alter table public.qbo_payment_allocations
  add column if not exists applied_services_amount numeric(14,2) not null default 0;

update public.qbo_payment_allocations
set applied_services_amount = applied_amount
where applied_services_amount is null or applied_services_amount = 0;
