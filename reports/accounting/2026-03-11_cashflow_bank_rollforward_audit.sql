-- Cash flow + bank roll-forward historical audit
-- Project ref: lqlyargzteskhsddbjpa
-- Purpose:
--   1) Verify monthly Income/Expenses used by cash flow table against QBO cash-basis P&L totals.
--   2) Build month-by-month bank roll-forward:
--      Starting(M) + Net(M) = EndingCalc(M), compare to EndingActual(M) from Balance Sheet.
--   3) Verify Ending(M) == Starting(M+1).
--
-- Coverage: 2023-05 through current month.
--
-- IMPORTANT:
-- - Starting bank for month M is prior month ending bank.
-- - If Balance Sheet ending bank is missing for a month, EndingActual is null and EndingCalc is carried.
-- - Net used in roll-forward is reconstructed income - reconstructed expenses,
--   matching the table's hybrid historical approach.

with month_series as (
  select to_char(gs::date, 'YYYY-MM') as month
  from generate_series(date '2023-05-01', date_trunc('month', now())::date, interval '1 month') gs
),
latest_pl as (
  select distinct on (to_char(s.period_start, 'YYYY-MM'))
    to_char(s.period_start, 'YYYY-MM') as month,
    s.id as snapshot_id,
    s.fetched_at
  from public.accounting_snapshots s
  where s.report_type = 'profit_and_loss'
    and s.basis = 'cash'
    and s.period_start = date_trunc('month', s.period_start)
    and s.period_end = (date_trunc('month', s.period_start) + interval '1 month - 1 day')::date
    and s.period_start >= date '2023-05-01'
  order by to_char(s.period_start, 'YYYY-MM'), s.fetched_at desc, s.id desc
),
pl_lines as (
  select
    lp.month,
    lower(trim(l.account_name)) as account_name,
    lower(trim(coalesce(l.section, ''))) as section,
    lower(trim(coalesce(l.parent_key, ''))) as parent_key,
    l.sort_order,
    coalesce(l.amount, 0)::numeric as amount,
    coalesce(l.is_total, false) as is_total,
    row_number() over (
      partition by lp.month, lower(trim(l.account_name))
      order by l.sort_order desc, l.snapshot_id desc
    ) as rn
  from latest_pl lp
  join public.accounting_snapshot_lines l on l.snapshot_id = lp.snapshot_id
),
pl_latest_line as (
  select * from pl_lines where rn = 1
),
pl_totals as (
  select
    month,
    max(case when account_name = 'total income' then amount end) as qbo_total_income,
    max(case when account_name = 'total expenses' then amount end) as qbo_total_expenses
  from pl_latest_line
  group by month
),
pl_reconstructed as (
  select
    month,
    sum(case when ((section like '%income%' or parent_key = 'income') and account_name <> 'total income') then amount else 0 end) as reconstructed_income,
    sum(case when ((section like '%expense%' or parent_key = 'expenses') and account_name <> 'total expenses' and account_name not like 'total %') then amount else 0 end) as reconstructed_expenses
  from pl_latest_line
  group by month
),
latest_bs as (
  select distinct on (to_char(s.period_end, 'YYYY-MM'))
    to_char(s.period_end, 'YYYY-MM') as month,
    s.id as snapshot_id,
    lower(s.basis) as basis,
    s.fetched_at
  from public.accounting_snapshots s
  where s.report_type = 'balance_sheet'
    and lower(s.basis) in ('accrual','cash')
    and s.period_end >= date '2023-04-01'
  order by to_char(s.period_end, 'YYYY-MM'),
    case when lower(s.basis) = 'accrual' then 0 else 1 end,
    s.fetched_at desc,
    s.id desc
),
bs_bank_ending as (
  select
    lb.month,
    sum(coalesce(l.amount, 0))::numeric as ending_bank_actual,
    jsonb_agg(distinct l.account_name) filter (where l.account_name is not null) as bank_accounts
  from latest_bs lb
  join public.accounting_snapshot_lines l on l.snapshot_id = lb.snapshot_id
  where lower(trim(coalesce(l.section, ''))) = 'assets'
    and coalesce(l.is_total, false) = false
    and lower(trim(l.account_name)) not like 'total %'
    and lower(trim(coalesce(l.parent_key, ''))) not like '%accounts receivable%'
    and (
      lower(trim(coalesce(l.parent_key, ''))) like '%bank%'
      or lower(trim(coalesce(l.parent_key, ''))) like '%cash%'
      or lower(trim(l.account_name)) ~ '(checking|savings|money market|operating|bank|cash)'
    )
  group by lb.month
),
assembled as (
  select
    ms.month,
    pt.qbo_total_income,
    pt.qbo_total_expenses,
    pr.reconstructed_income,
    pr.reconstructed_expenses,
    (coalesce(pt.qbo_total_income,0) - coalesce(pt.qbo_total_expenses,0))::numeric as net_income_qbo_lines,
    (coalesce(pr.reconstructed_income,0) - coalesce(pr.reconstructed_expenses,0))::numeric as net_income_reconstructed,
    be.ending_bank_actual,
    be.bank_accounts
  from month_series ms
  left join pl_totals pt on pt.month = ms.month
  left join pl_reconstructed pr on pr.month = ms.month
  left join bs_bank_ending be on be.month = ms.month
),
iter as (
  with recursive r as (
    select
      a.month,
      a.qbo_total_income,
      a.qbo_total_expenses,
      a.reconstructed_income,
      a.reconstructed_expenses,
      a.net_income_qbo_lines,
      a.net_income_reconstructed,
      a.ending_bank_actual,
      a.bank_accounts,
      coalesce(prev.ending_bank_actual,
        case
          when a.ending_bank_actual is not null then a.ending_bank_actual - coalesce(a.net_income_reconstructed,0)
          else 0
        end
      )::numeric as starting_bank,
      case
        when a.ending_bank_actual is not null then a.ending_bank_actual
        else coalesce(prev.ending_bank_actual,
          case when a.ending_bank_actual is not null then a.ending_bank_actual - coalesce(a.net_income_reconstructed,0) else 0 end
        )::numeric + coalesce(a.net_income_reconstructed,0)
      end::numeric as ending_bank_calc
    from assembled a
    left join assembled prev on prev.month = to_char((to_date(a.month || '-01','YYYY-MM-DD') - interval '1 month')::date,'YYYY-MM')
    where a.month = (select min(month) from assembled)

    union all

    select
      a.month,
      a.qbo_total_income,
      a.qbo_total_expenses,
      a.reconstructed_income,
      a.reconstructed_expenses,
      a.net_income_qbo_lines,
      a.net_income_reconstructed,
      a.ending_bank_actual,
      a.bank_accounts,
      r.ending_bank_calc as starting_bank,
      case
        when a.ending_bank_actual is not null then a.ending_bank_actual
        else r.ending_bank_calc + coalesce(a.net_income_reconstructed,0)
      end::numeric as ending_bank_calc
    from r
    join assembled a on a.month = to_char((to_date(r.month || '-01','YYYY-MM-DD') + interval '1 month')::date,'YYYY-MM')
  )
  select * from r
)
select
  i.month,
  round(coalesce(i.qbo_total_income,0),2) as qbo_total_income,
  round(coalesce(i.reconstructed_income,0),2) as table_total_income,
  round(coalesce(i.reconstructed_income,0) - coalesce(i.qbo_total_income,0),2) as income_delta,
  round(coalesce(i.qbo_total_expenses,0),2) as qbo_total_expenses,
  round(coalesce(i.reconstructed_expenses,0),2) as table_total_expenses,
  round(coalesce(i.reconstructed_expenses,0) - coalesce(i.qbo_total_expenses,0),2) as expenses_delta,
  round(coalesce(i.net_income_reconstructed,0),2) as net_income_used,
  round(coalesce(i.starting_bank,0),2) as starting_bank,
  round(coalesce(i.ending_bank_calc,0),2) as ending_bank_calc,
  round(coalesce(i.ending_bank_actual, i.ending_bank_calc),2) as ending_bank_actual_or_calc,
  round(coalesce(i.ending_bank_actual, i.ending_bank_calc) - i.ending_bank_calc,2) as bank_variance,
  round(lead(coalesce(i.starting_bank,0)) over (order by i.month) - coalesce(i.ending_bank_actual, i.ending_bank_calc),2) as next_month_start_delta,
  i.bank_accounts
from iter i
order by i.month;

