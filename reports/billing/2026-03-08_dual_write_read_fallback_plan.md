# Billing Dual-Write / Read-Fallback Plan

- Scope: expense billing status compatibility + bill/labor rate snapshots + billing period compatibility.
- Goal: allow old and new app/database paths to coexist through phased rollout with no downtime.

## Canonical Rules

### Expense status (`project_expenses`)
- New canonical field: `billing_status`.
- Legacy compatibility field: `status`.
- Canonical values in this rollout: `pending`, `invoiced`, `ignored`.

Write policy:
- App/UI writers should set both:
  - `billing_status` directly (canonical)
  - `status` via `legacyStatusFromBillingStatus(...)` for backward compatibility.
- DB trigger `sync_project_expense_status_fields()` remains active as a safety net for any writer that sets only one field.

Read policy:
- App/UI readers should compute effective state via `normalizeExpenseBillingStatus(...)`, not by directly trusting one column.
- During compatibility window, `normalizeExpenseBillingStatus(...)` must accept mixed rows where only one column is present.

## Rate snapshot fields (`time_entry_bill_rates`)

Canonical read fields for billables logic:
- Bill side: `resolved_hourly_rate`, `rate_source`, `rate_source_id`, `effective_from_used`
- Labor side: `resolved_labor_hourly_rate`, `labor_rate_source`, `labor_rate_source_id`, `labor_effective_from_used`

Write policy:
- QBO time sync writes both bill and labor snapshot fields for each `time_entry_id`.
- If labor cannot be resolved from external source, write deterministic fallback metadata (for example, `qbo_derived_zero`) instead of leaving source fields null.

Read policy:
- For reporting, treat `resolved_hourly_rate = 0` as an explicit unresolved/zero-rate state and keep source metadata available for diagnostics.
- Do not infer unresolved state from null alone because rows may be explicitly zero-valued by policy.

## Billing period fields

Canonical billing period fields:
- `time_entries.billing_period`
- `invoices.billing_period`
- `invoice_line_items.billing_period`

Write policy:
- QBO sync should continue writing billing periods from source transaction dates.
- For manual/UI-generated rows, write billing periods from local business date logic at insertion time.

Read policy:
- During compatibility window, reports can fallback to legacy date columns where billing period is null:
  - invoices: fallback to `date_issued`
  - time entries: fallback to month-start of `entry_date`
  - invoice line items: fallback to invoice billing period (via `invoice_id`) when row-level period is null

## Current Implementation Status (this branch)

- Implemented:
  - `project_expenses.billing_status` added with compatibility trigger.
  - `normalizeExpenseBillingStatus(...)` and `legacyStatusFromBillingStatus(...)` utility in `src/lib/finance/expense-billing-status.ts`.
  - UI dual-write/read-fallback in:
    - `src/app/(authenticated)/reimbursables/page.tsx`
    - `src/app/(authenticated)/projects/[id]/page.tsx`
  - API fallback usage in:
    - `src/app/api/projects/multipliers/route.ts`
  - QBO sync snapshot writes for new fields in:
    - `src/lib/qbo/sync/domains/time-entries.ts`
    - `src/lib/qbo/sync/domains/invoices.ts`

- Still required before full cutover:
  - Backfill `time_entries.billing_period` (`2530` currently null in baseline snapshot).
  - Backfill lineage/snapshot fields for legacy `invoice_line_items` rows (`source_table`, `source_row_id`, `billing_period`, and source linkage are currently null for all legacy rows in baseline snapshot).
  - Reduce/triage zero bill-rate population (`resolved_hourly_rate` zero-or-null currently `766`) into expected exceptions vs defects.

## Compatibility Exit Criteria

- `project_expenses`: no readers depend on legacy `status`; all reads use normalized status.
- `time_entries`: `billing_period` fully populated and used by report filters.
- `invoice_line_items`: lineage/snapshot fields populated for rows in in-scope historical window.
- Monitoring confirms no drift between compatibility field pairs for at least 2 release cycles.
