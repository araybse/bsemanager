# Billing Baseline Audit Pack

- Generated at (UTC): `2026-03-08T11:59:09Z`
- Supabase project ref: `lqlyargzteskhsddbjpa`
- Query source: `reports/billing/2026-03-08_baseline_audit_pack.sql`

## Core Metrics Snapshot

### `time_entries`
- total: `2530`
- with `qb_time_id`: `2530`
- without `qb_time_id`: `0`
- `billing_period` null: `2530`
- `entry_date` null: `0`
- total hours: `8278.50`

### `time_entry_bill_rates`
- total rows: `2530`
- distinct `time_entry_id`: `2530`
- `time_entry_id` null: `0`
- `resolved_hourly_rate` null: `0`
- `resolved_hourly_rate` zero-or-null: `766`
- `resolved_labor_hourly_rate` null: `0`
- `resolved_labor_hourly_rate` zero-or-null: `0`
- `rate_source` null: `0`
- `labor_rate_source` null: `0`

### `invoices`
- total: `320`
- total amount: `1740930.32`
- `billing_period` null: `0`
- `date_issued` set but `billing_period` null: `0`

### `invoice_line_items`
- total: `504`
- total amount: `1740930.32`
- total hours: `0.00`
- total labor cost: `0.00`
- total profit amount: `0.00`
- linked `time_entry_id`: `0`
- linked `project_expense_id`: `0`
- unlinked rows: `504`
- `source_table` null: `504`
- `source_row_id` null: `504`
- `billing_period` null: `504`

### `project_expenses`
- total: `177`
- `billing_status` null: `0`
- `status` null: `0`
- `billing_status = invoiced`: `117`
- `invoice_id` set: `117`
- invoiced without `invoice_id`: `0`
- non-invoiced with `invoice_id`: `0`

## Distributions

### `project_expenses.billing_status`
- `ignored`: `1`
- `invoiced`: `117`
- `pending`: `59`

### `invoice_line_items.source_table`
- `<null>`: `504`

## Parity Checks

- `time_entry_bill_rates.distinct_time_entry_ids` vs `time_entries.total`: `2530` vs `2530` (difference `0`)
- `project_expenses.billing_status_invoiced` vs `project_expenses.invoice_id_set`: `117` vs `117` (difference `0`)

## Compat Objects Check

- `employee_title_history` exists: `true`
- `employee_position_history` exists: `true`

## 15-Month Trend Highlights

- Snapshot window includes `2025-01` through `2026-02`
- Months with highest `tbr_zero_or_null_bill_rate_rows` in window:
  - `2026-02`: `58`
  - `2025-12`: `53`
  - `2026-01`: `48`
  - `2025-04`: `47`
  - `2025-07`: `47`
- `billable_time_entries` are sparse in the recent window, consistent with current app behavior where report logic may use all entries while `is_billable` flags are often false.

## Notes / Immediate Risks Flagged

- `time_entries.billing_period` is fully null (`2530/2530`) and needs backfill + dual-write enforcement before relying on billing-period filters.
- `invoice_line_items` has no population for new lineage/snapshot fields yet (`source_table`, `source_row_id`, `billing_period`, `time_entry_id`, `project_expense_id` all effectively empty), indicating app/data backfill work still pending in rollout.
- `time_entry_bill_rates` has a meaningful zero-rate population (`766`) that should be split into expected zero-rate cases vs unresolved-rate defects during subsequent to-dos.
