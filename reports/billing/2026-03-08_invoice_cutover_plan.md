# Invoice Generation Cutover Plan

- Objective: introduce billing-v2 invoice generation (with lineage/snapshot fields) while safely coexisting with:
  - current `public.finalize_invoice(p_invoice_id)`
  - existing QBO invoice sync (`src/lib/qbo/sync/domains/invoices.ts`)
- Deployment model: expand -> dual-run -> shadow-verify -> cutover -> contract.

## Current State (Baseline)

- DB functions present:
  - `public.get_next_invoice_number(p_project_number text)`
  - `public.finalize_invoice(p_invoice_id integer)`
- `finalize_invoice` currently:
  - rolls contract phase billed totals from `invoice_line_items`
  - marks `reimbursables` as invoiced (legacy table)
  - marks all billable unbilled `time_entries` as billed and sets `billing_period` from invoice date month
- QBO invoice sync currently upserts:
  - `invoices` (including `billing_period`)
  - `invoice_line_items` (line delete+reinsert per invoice with `source_table='qbo'` for synced rows)

## Cutover Design

### Phase A: Prepare interfaces (no behavior change)
- Add new stored procedure API shape (example): `generate_invoice_v2(p_project_id, p_billing_period, p_options jsonb)`.
- Keep `finalize_invoice` untouched and callable.
- Add feature flag gate in app/service layer:
  - `invoice_generation_mode = legacy | shadow | v2`.

### Phase B: Implement v2 generation in shadow mode
- v2 generator writes invoice + line items with lineage:
  - `invoice_line_items.time_entry_id`
  - `invoice_line_items.project_expense_id`
  - `source_table`, `source_row_id`, `billing_period`
  - `hours`, `billable_rate`, `labor_cost`, `profit_amount`
- In `shadow` mode:
  - run legacy generation as source-of-truth write path
  - run v2 in simulation (temp table / transaction rollback / dry-run return payload)
  - compare totals and row counts before any cutover.

### Phase C: Controlled cutover
- Flip flag from `legacy` to `v2` for admin-only cohorts first.
- Keep `finalize_invoice` callable for rollback window.
- Keep QBO invoice sync as authoritative for QBO-origin invoices:
  - If `source_table='qbo'`, do not overwrite with local generation logic.

### Phase D: Contract/cleanup
- After stable verification window:
  - route all generation to v2
  - deprecate legacy-only assumptions in report queries
  - preserve `finalize_invoice` as compatibility wrapper or retire it with migration plan.

## Coexistence Contract with QBO Sync

- QBO sync is authoritative for rows with `qb_invoice_id` and `invoice_line_items.source_table='qbo'`.
- App/manual generation is authoritative for rows with non-qbo source types.
- Re-sync behavior for QBO invoices can continue delete+reinsert by `invoice_id`, but must preserve local-only invoices by avoiding `qb_invoice_id` collisions.
- Add invariant checks:
  - one invoice row per `qb_invoice_id`
  - one line uniqueness key per (`invoice_id`, `source_table`, `source_row_id`) when `source_row_id` present.

## Rollback Strategy

- Immediate rollback: set feature flag to `legacy`.
- Data rollback:
  - for v2-created invoices in cutover window, soft-delete or mark as superseded instead of hard-delete when possible.
  - avoid destructive edits on QBO-linked invoices during rollback.
- Keep legacy function and legacy UI path intact until 2 stable release cycles pass.

## Validation Gates for Cutover Approval

- Financial parity:
  - invoice total parity (legacy vs v2) within configured tolerance (`0.00` target).
  - line count parity for in-scope billing period/project.
- Data quality:
  - no null lineage on newly generated v2 line items.
  - no unexpected zero rates without a known source classification.
- Operational:
  - no increase in failed sync runs.
  - no growth in unresolved billing status mismatches.

## Implementation Notes

- This plan intentionally avoids editing the existing plan source document and records execution detail as a separate artifact.
- Baseline evidence is captured in:
  - `reports/billing/2026-03-08_baseline_audit_pack.md`
  - `reports/billing/2026-03-08_baseline_audit_pack.sql`
