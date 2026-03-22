# Rate Cleanup and Lineage Progress

## Zero/Unresolved Rate Diagnostics (Before)

- Zero-or-null `resolved_hourly_rate` rows: `766`
- All zero-rate rows had `project_id = null`
- Breakdown:
  - Non-billable: `763`
  - Billable: `3` (all `General / GO`, employee `Austin Ray`, 15.00 hours total)
- Rate source before classification:
  - `unresolved`: `766`

## Phase 7.3 Applied

- Migration: `phase7_3_classify_internal_zero_rates`
- Change:
  - Reclassified known internal non-project overhead rows from `rate_source='unresolved'`
    to `rate_source='non_project_internal'`
  - Conditions were conservative:
    - `resolved_hourly_rate = 0`
    - `project_id is null`
    - `is_billable = false`
    - `project_number` in known overhead code list

## Zero/Unresolved Rate Diagnostics (After)

- Zero-or-null `resolved_hourly_rate` rows: `766` (unchanged total)
- Rate source after classification:
  - `non_project_internal`: `763`
  - `unresolved`: `3`
- Remaining unresolved actionable rows:
  - count: `3`
  - hours: `15.00`
  - all are billable entries on `project_number='General'` / `phase_name='GO'`

## Deterministic Lineage Linking Progress

- Migration: `phase7_4_link_reimbursable_line_items`
- Strategy:
  - Link `invoice_line_items.project_expense_id` only when there is exactly one exact match on:
    - `project_number`
    - `invoice_number`
    - rounded cents equality: `project_expenses.amount_to_charge == invoice_line_items.amount`
- Results:
  - `invoice_line_items` total: `504`
  - reimbursable lines total: `71`
  - reimbursable lines linked: `37`
  - reimbursable lines still unlinked: `34`
  - ambiguous matches linked: `0` (none linked unless unique)
  - `time_entry_id` links: `0` (no deterministic one-to-one signal available in current historical data model)

## Build Validation

- `npm run build` passes after code and migration updates.
