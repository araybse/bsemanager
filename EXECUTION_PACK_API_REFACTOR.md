# Execution Pack - API Refactor Task List

Source contract: `BACKEND_PRODUCT_SPEC_V2.md`

## Objective

Refactor existing APIs to:

- implement one-way QBO -> Supabase pipelines with deterministic writes
- centralize multiplier/read-model logic
- add sync observability
- avoid UI-side formula drift

## Current API Inventory

- `src/app/api/qb-time/auth/route.ts`
- `src/app/api/qb-time/callback/route.ts`
- `src/app/api/qb-time/items/route.ts`
- `src/app/api/qb-time/sync/route.ts`
- `src/app/api/qb-time/webhook/route.ts`
- `src/app/api/projects/multipliers/route.ts`

## Target Refactor Structure

Create domain modules under:

- `src/lib/qbo/sync/customers.ts`
- `src/lib/qbo/sync/projects.ts`
- `src/lib/qbo/sync/invoices.ts`
- `src/lib/qbo/sync/time-entries.ts`
- `src/lib/qbo/sync/project-expenses.ts`
- `src/lib/qbo/sync/transactions.ts`
- `src/lib/qbo/sync/common.ts` (pagination, retries, run logging helpers)

Route handlers become thin orchestrators.

## Phase-by-Phase Tasks

## Phase A - Shared Sync Infrastructure

1. Add `startSyncRun(domain, triggerMode, payload)` helper.
2. Add `completeSyncRun(runId, counts, status, errors)` helper.
3. Add `advanceWatermark(domain, timestamp, cursor)` helper.
4. Add shared `qboQueryPaged()` helper with:
   - `STARTPOSITION` loop
   - retry with bounded backoff
   - max page guardrails
5. Add idempotent upsert helpers by external key.

## Phase B - Split `qb-time/sync` Domains

Replace monolithic logic in `src/app/api/qb-time/sync/route.ts` with domain calls:

- `syncCustomers()`
- `syncProjects()`
- `syncInvoicesAndLines()`
- `syncTimeEntries()`
- `syncProjectExpenses()`
- `syncTransactionsForReporting()`

Expected behavior:

- each domain writes to `sync_runs`
- each successful domain advances `sync_watermarks`
- partial domain failures return `partial_success` payload, not silent success

## Phase C - Invoices and Line Items Hardening

1. Always fetch full invoice details for lines (or fallback expansion path).
2. Replace line items per invoice atomically:
   - delete existing by `invoice_id`
   - insert full current set
3. Keep invoice header synced regardless of payment status.
4. Derive reimbursable line classification consistently:
   - `line_type = reimbursable` when phase/service naming matches reimb rules.

## Phase D - Time Entries + Rate Snapshot

1. Upsert by `qb_time_id`.
2. Resolve project by `project_number` first; fallback to mapped `project_id`.
3. Resolve and persist billing snapshot into `time_entry_bill_rates`:
   - employee title by entry date
   - rate card by title/effective date
4. Never retroactively overwrite historical `time_entry_bill_rates` unless explicit re-rate endpoint is introduced.

## Phase E - Unified Project Expenses Domain

1. Replace direct `contract_labor` write path with `project_expenses` writes.
2. Parse QBO Purchase/Bill lines into canonical fields:
   - project mapping
   - category/subcategory
   - fee amount/date/vendor/description
3. Reconciliation:
   - maintain seen-key set per run
   - delete/soft-delete missing external keys by policy
4. Add reimbursable toggles as app-side workflow (outside QBO sync path).

## Phase F - Multiplier API Centralization

Update `src/app/api/projects/multipliers/route.ts` to consume one backend source:

- recommended: `project_multiplier_view`
- alternative: service function that reproduces view formula once

Hard requirements:

- no duplicated math in UI pages
- all project-number matching normalized/trimmed
- returns `null` for invalid denominator/numerator cases

## Phase G - Webhook Processing

Update `src/app/api/qb-time/webhook/route.ts`:

1. Keep signature verification required.
2. Map webhook entities to domains:
   - Invoice -> invoice sync
   - Purchase/Bill -> project-expense sync
   - TimeActivity -> time sync
3. Trigger lightweight domain runs, not full sync-all.
4. Log each webhook-triggered run in `sync_runs`.

## Completion Checklist

- [ ] Monolith split complete
- [ ] Domain runs logged in `sync_runs`
- [ ] Watermarks maintained in `sync_watermarks`
- [ ] Invoices include unpaid/issued status and line items parity
- [ ] Time entries always update existing matches
- [ ] Project expenses sourced from canonical pipeline
- [ ] Multiplier API uses single canonical backend formula
- [ ] Webhook route triggers domain-specific syncs

## Recommended Test Plan

1. Run manual sync per domain; verify `sync_runs` rows.
2. Insert new unpaid invoice in QBO; verify local header+lines.
3. Edit existing QBO invoice status; verify local update.
4. Add and update QBO time activity; verify upsert and rate snapshot.
5. Add/delete QBO expense in target category; verify canonical expense ledger update + reconciliation.
6. Compare project list/detail multipliers for a sample set; verify exact match.
