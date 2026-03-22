# Billing Redesign Phase-Gate Checklist

Use this checklist at each rollout phase boundary: Prepare -> Expand -> Backfill/Dual-Write -> App Refactor -> Cutover -> Cleanup.

## Gate 0: Pre-Deploy Baseline (Prepare)

- [ ] Run baseline audit SQL: `reports/billing/2026-03-08_baseline_audit_pack.sql`
- [ ] Store snapshot artifact and timestamp
- [ ] Confirm rollback operator + decision owner
- [ ] Confirm maintenance-free deployment window (no downtime expected)

Rollback checkpoint:
- If baseline cannot be captured consistently across two runs, halt migration rollout.

## Gate 1: Schema Expand Validation

### SQL checks
- [ ] `invoices.billing_period` exists and is indexed as expected
- [ ] `invoice_line_items` new columns exist (`time_entry_id`, `project_expense_id`, `source_table`, `source_row_id`, `billing_period`, `hours`, `billable_rate`, `labor_cost`, `profit_amount`)
- [ ] FKs/check constraints present for new `invoice_line_items` linkage/source fields
- [ ] `time_entry_bill_rates` labor snapshot columns exist
- [ ] `project_expenses.billing_status` exists + check constraint exists
- [ ] `employee_position_history` compatibility object exists

### RLS checks
- [ ] Authenticated app roles can still read/write impacted tables through existing routes
- [ ] No new policy regression for `admin`, `project_manager`, `employee`, `client`

Rollback checkpoint:
- If schema migration produces blocking errors or policy regressions, rollback migration batch before app changes.

## Gate 2: Backfill + Dual-Write Validation

### SQL/data checks
- [ ] `time_entries.billing_period` backfill complete for in-scope historical window
- [ ] Legacy `invoice_line_items` populated for required lineage/snapshot fields or explicitly marked out-of-scope
- [ ] `project_expenses.status` and `billing_status` remain in sync (spot-check and aggregate check)
- [ ] `time_entry_bill_rates` zero-rate rows are classified as expected vs unresolved defects

### API checks
- [ ] `GET /api/projects/multipliers` returns consistent values pre/post backfill
- [ ] `GET /api/ops/health` remains healthy/warning with no unexpected failures

Rollback checkpoint:
- If parity drifts beyond threshold, disable new write path/feature flag and re-run backfill in safe batches.

## Gate 3: App Refactor Validation

### UI checks
- [ ] Reimbursables page uses normalized billing status correctly
- [ ] Project detail expenses reflect invoiced/pending/ignored consistently
- [ ] Billables report month filters still return expected row counts after billing-period changes
- [ ] Settings tabs and migrated navigation remain functional

### API + sync checks
- [ ] QBO time sync writes new billing-period and labor snapshot fields
- [ ] QBO invoice sync writes `source_table/source_row_id/billing_period` for new rows
- [ ] No auth regressions on protected API routes

Rollback checkpoint:
- If any critical workflow fails (sync, billables report, invoicing), revert app deploy and keep expanded schema.

## Gate 4: Invoice Generation Cutover Validation

### Financial parity checks
- [ ] Legacy vs v2 invoice totals match for sample projects and months
- [ ] Line item counts and type distributions match expected mappings
- [ ] No duplicate invoice identifiers or orphaned line items

### Operational checks
- [ ] Sync run failure rate unchanged
- [ ] Data-quality checks do not regress
- [ ] Dashboard financial cards still populate correctly

Rollback checkpoint:
- If parity or operations regress, flip feature flag to legacy generation path immediately.

## Gate 5: Cleanup / Contract Validation

- [ ] No remaining app reads that depend directly on legacy-only status semantics
- [ ] Compatibility trigger can be retired (only after multi-release confirmation)
- [ ] Legacy docs/scripts updated to new canonical fields
- [ ] Advisors/security scan re-run after final DDL changes

Rollback checkpoint:
- Do not drop compatibility paths until post-cutover metrics are stable for at least two release cycles.

## Verification Commands / Actions

- SQL:
  - run baseline and monthly snapshot queries from `reports/billing/2026-03-08_baseline_audit_pack.sql`
- Build/test:
  - `npm run build`
  - targeted browser smoke test: dashboard, projects, invoices, billables, reimbursables, settings
- Runtime:
  - check sync health and recent run outcomes

## Signoff Template

- Phase:
- Date/time (UTC):
- Operator:
- SQL checks: pass/fail
- API checks: pass/fail
- UI checks: pass/fail
- RLS checks: pass/fail
- Rollback exercised: yes/no
- Notes / exceptions:
