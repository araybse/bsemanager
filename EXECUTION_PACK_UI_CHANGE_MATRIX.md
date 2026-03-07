# Execution Pack - UI Change Matrix

Source contract: `BACKEND_PRODUCT_SPEC_V2.md`

This matrix maps required UI behavior changes to concrete files and implementation notes.

## Legend

- **Priority**: P1 (immediate), P2 (near-term), P3 (later)
- **Type**: Read-model alignment, workflow, metrics, polish

## 1) Dashboard

- **File**: `src/app/(authenticated)/dashboard/page.tsx`
- **Priority**: P1
- **Type**: Metrics/read-model alignment
- **Changes**:
  - Add dynamic invoiced-by-month chart with selectable month window.
  - Keep AR card sourced from unpaid invoices/read view.
  - Active projects table multiplier must use canonical multiplier API/view only.
  - Add dynamic labor-cost pie chart:
    - project selector
    - mode toggle (`employee` vs `phase`)
  - Add role-aware filtering:
    - admin sees all
    - PM sees assigned projects only

## 2) Projects List

- **File**: `src/app/(authenticated)/projects/page.tsx`
- **Priority**: P1
- **Type**: Formula unification
- **Changes**:
  - Remove any local fallback multiplier calculations.
  - Render only canonical multiplier values from `/api/projects/multipliers`.
  - Preserve year grouping and filters.
  - Keep archive optimistic UI behavior.
  - Ensure project number normalization (`trim`) before requesting multipliers.

## 3) Project Detail - Dashboard Tab

- **File**: `src/app/(authenticated)/projects/[id]/page.tsx`
- **Priority**: P1
- **Type**: Formula unification
- **Changes**:
  - Ensure Revenue card uses canonical definition:
    - total issued invoice amount minus reimbursable pass-through where required by contract.
  - Ensure Project Cost card:
    - BSE labor + non-pass-through project expenses.
  - Ensure Project Multiplier:
    - exact same canonical backend source as projects list.
  - Remove any duplicate local variants that can drift.

## 4) Project Detail - Labor Tab

- **File**: `src/app/(authenticated)/projects/[id]/page.tsx`
- **Priority**: P2
- **Type**: Workflow/reporting
- **Changes**:
  - Keep filters (date/employee/phase).
  - Ensure full pagination for all project time entries.
  - Exclude rows by business rule where needed (e.g., Morgan Wilson exclusion policy).
  - If rate snapshot table is adopted, show resolved bill rate optionally in unbilled context (not required in labor tab).

## 5) Project Detail - Contract Labor / Expenses Tab

- **File**: `src/app/(authenticated)/projects/[id]/page.tsx`
- **Priority**: P2
- **Type**: Unified expense migration
- **Changes**:
  - Migrate table source from `contract_labor` to `project_expenses` filtered subset.
  - Show vendor/date/description/amount/project.
  - Preserve sorting/filtering behavior.
  - Respect one-way mode: editing hidden unless policy changes.

## 6) Invoices Page

- **File**: `src/app/(authenticated)/invoices/page.tsx`
- **Priority**: P1
- **Type**: Data parity
- **Changes**:
  - Confirm table includes all issued invoices (not just paid).
  - Keep expandable line-item breakdown.
  - Keep total row for filtered list.
  - Ensure line-item alignment with invoice total parity expectations.

## 7) Unbilled Report

- **File**: `src/app/(authenticated)/unbilled/page.tsx`
- **Priority**: P2
- **Type**: Rate logic
- **Changes**:
  - Replace ad hoc rate lookup with `time_entry_bill_rates` snapshot source.
  - Show amount-to-bill per time entry from resolved snapshot rate.
  - Keep grouped rollups by project/phase/employee.

## 8) Reimbursables Page -> Project Expenses Workflow

- **File**: `src/app/(authenticated)/reimbursables/page.tsx`
- **Priority**: P2
- **Type**: Workflow redesign
- **Changes**:
  - Repoint data source to `project_expenses`.
  - Columns:
    - expense date
    - description
    - fee amount
    - reimbursable checkbox
    - amount to charge
    - status
    - invoice number
  - Checkbox behavior:
    - when true, amount-to-charge auto-computed at 115%
    - status transitions pending -> ready_to_invoice -> invoiced

## 9) Proposals Page

- **File**: `src/app/(authenticated)/proposals/page.tsx`
- **Priority**: P2
- **Type**: Data model extension
- **Changes**:
  - Add UI management for proposal-level rate cards:
    - position/title
    - hourly rate
    - effective dates
  - Keep current proposal + phase editing behavior.
  - Maintain executed proposal linkage to project.

## 10) Time Entries Page

- **File**: `src/app/(authenticated)/time-entries/page.tsx`
- **Priority**: P1
- **Type**: Data completeness
- **Changes**:
  - Keep current filters/sort.
  - Ensure all entries load via pagination.
  - Keep billed/unbilled status visibility.

## 11) Profit and Loss Page (new/expanded)

- **Likely file**: add `src/app/(authenticated)/profit-loss/page.tsx` (or update existing reporting route)
- **Priority**: P3
- **Type**: New report UI
- **Changes**:
  - Dynamic period selector.
  - QBO category/subcategory rows.
  - Totals by period and net result.

## 12) Cash Flow Page

- **File**: `src/app/(authenticated)/cash-flow/page.tsx`
- **Priority**: P3
- **Type**: Replace placeholder
- **Changes**:
  - Implement spreadsheet-style monthly budget/projection grid.
  - Income and expense sections by QBO categories.
  - Monthly totals and net cash flow row.

## 13) Settings Page

- **File**: `src/app/(authenticated)/settings/page.tsx`
- **Priority**: P2
- **Type**: Ops visibility
- **Changes**:
  - Extend sync status panels to include:
    - last run status by domain
    - counts and error summary (from `sync_runs`)
    - watermark freshness indicators

## Cross-Cutting UI Rules

1. Any multiplier shown anywhere must come from one canonical backend source.
2. Any total displayed in cards/tables must map to one documented formula definition.
3. No silent local fallbacks for financial KPIs.
4. Keep role-based visibility consistent between sidebar and data filters.

## Suggested Delivery Order (UI)

1. Projects list + project detail multiplier source unification.
2. Dashboard metric parity and role-aware behavior.
3. Invoices/time entries completeness validation.
4. Reimbursables -> unified project expenses UI migration.
5. Unbilled report rate snapshot integration.
6. Settings sync observability panel.
7. Cash flow and P&L buildout.
