# QBO vs Supabase True-Up + Unlinked Line Analysis

## 1) Remaining Unlinked Reimbursable Invoice Lines

Post deterministic linking (`phase7_4_link_reimbursable_line_items`):

- Unlinked reimbursable invoice lines: `34`
- Reason split:
  - `31` = `project_expense_exists_but_amount_mismatch`
  - `3` = `no_project_expense_for_project_plus_invoice_number`
- No ambiguous multi-exact matches were force-linked.

Interpretation:
- These are not safe to auto-link with strict deterministic rules.
- Most remaining lines likely represent grouped/rolled-up QBO reimbursable totals vs more granular expense rows in `project_expenses`.

## 2) Time Entries True-Up (QuickBooks vs Supabase)

### Annual comparison runs

- 2023: QBO `484` vs local `484`, delta `0`, project mismatches `0`, employee mismatches `0`
- 2024: QBO `325` vs local `325`, delta `0`, project mismatches `0`, employee mismatches `0`
- 2025: QBO `1356` vs local `1356`, delta `0`, project mismatches `0`, employee mismatches `0`
- 2026 YTD (to 2026-03-08): QBO `365` vs local `365`, delta `0`, project mismatches `0`, employee mismatches `0`

### 2025 monthly comparison runs (month-by-month)

- Jan: `0` vs `0`, delta `0`
- Feb: `0` vs `0`, delta `0`
- Mar: `122` vs `122`, delta `0`
- Apr: `121` vs `121`, delta `0`
- May: `133` vs `133`, delta `0`
- Jun: `133` vs `133`, delta `0`
- Jul: `194` vs `194`, delta `0`
- Aug: `129` vs `129`, delta `0`
- Sep: `108` vs `108`, delta `0`
- Oct: `164` vs `164`, delta `0`
- Nov: `132` vs `132`, delta `0`
- Dec: `120` vs `120`, delta `0`

All monthly runs reported:
- `projectMismatchCount = 0`
- `employeeMismatchCount = 0`

## 3) Invoices True-Up

Latest invoice sync run:
- status: `success`
- imported: `0`
- updated: `248`
- deleted: `0`
- skipped: `0`
- errors: `0`

Result:
- QBO invoice dataset is syncing cleanly into Supabase for the current sync window with no reported sync errors.

## 4) Notes

- Month-by-month true-up support was added to `/api/qb-time/sync` (year + month) to avoid long timeout-prone year runs.
- True-up evidence came from actual sync comparison payloads stored in `sync_runs.error_summary.comparison`.
