-- =============================================================================
-- Migration: Fix Duplicate Project Expenses
-- Date: 2026-04-06
-- Description: 
--   1. Identifies duplicate project_expenses rows caused by unstable source_line_id
--   2. Soft-deletes duplicates, keeping the oldest record
--   3. Logs cleanup activity for audit trail
-- =============================================================================

BEGIN;

-- Step 1: Create a temp table to identify duplicates
-- We consider rows duplicates if they have the same:
-- - source_entity_id (the QB transaction ID like "Purchase:456")
-- - fee_amount
-- - expense_date
-- - vendor_name
-- - project_number
-- When these match, the different source_line_id values indicate the line-index bug.

CREATE TEMP TABLE duplicate_expenses AS
WITH ranked AS (
  SELECT 
    id,
    source_entity_id,
    source_line_id,
    fee_amount,
    expense_date,
    vendor_name,
    project_number,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type IN ('project_expense', 'contract_labor')
    AND source_active = true
)
SELECT 
  id,
  source_entity_id,
  source_line_id,
  fee_amount,
  expense_date,
  vendor_name,
  project_number,
  rn
FROM ranked
WHERE rn > 1;  -- All rows except the first (oldest) one

-- Step 2: Log how many will be deactivated
DO $$
DECLARE
  dupe_count INTEGER;
  dupe_amount NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(fee_amount), 0)
  INTO dupe_count, dupe_amount
  FROM duplicate_expenses;
  
  RAISE NOTICE 'Found % duplicate expense records totaling $%', dupe_count, dupe_amount;
END $$;

-- Step 3: Soft-delete duplicates (keep oldest, deactivate newer ones)
UPDATE public.project_expenses
SET 
  source_active = false,
  source_closed_at = NOW(),
  source_close_reason = 'duplicate_cleanup_2026_04_06_line_index_bug',
  updated_at = NOW()
WHERE id IN (SELECT id FROM duplicate_expenses);

-- Step 4: Verify no active duplicates remain
DO $$
DECLARE
  remaining_dupes INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO remaining_dupes
  FROM (
    SELECT 
      source_entity_id, fee_amount, expense_date, vendor_name, project_number,
      COUNT(*) as cnt
    FROM public.project_expenses
    WHERE source_system = 'qbo'
      AND source_entity_type IN ('project_expense', 'contract_labor')
      AND source_active = true
    GROUP BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
    HAVING COUNT(*) > 1
  ) dups;
  
  IF remaining_dupes > 0 THEN
    RAISE WARNING 'Warning: % duplicate groups still remain. Manual review may be needed.', remaining_dupes;
  ELSE
    RAISE NOTICE 'Success: No active duplicates remain.';
  END IF;
END $$;

-- Step 5: Drop temp table
DROP TABLE IF EXISTS duplicate_expenses;

COMMIT;
