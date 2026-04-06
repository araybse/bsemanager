-- =============================================================================
-- Audit Script: Identify Duplicate Project Expenses (DRY RUN)
-- Run this BEFORE applying the fix migration to see what will be affected
-- =============================================================================

-- Query 1: Summary - How many duplicates exist per project?
SELECT 
  project_number,
  COUNT(*) as duplicate_count,
  SUM(fee_amount)::NUMERIC(14,2) as duplicate_total_amount
FROM (
  SELECT 
    id,
    project_number,
    fee_amount,
    ROW_NUMBER() OVER (
      PARTITION BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type IN ('project_expense', 'contract_labor')
    AND source_active = true
) ranked
WHERE rn > 1
GROUP BY project_number
ORDER BY duplicate_total_amount DESC;


-- Query 2: Overall totals
SELECT 
  COUNT(*) as total_duplicate_records,
  SUM(fee_amount)::NUMERIC(14,2) as total_duplicate_amount,
  COUNT(DISTINCT project_number) as affected_projects
FROM (
  SELECT 
    id,
    project_number,
    fee_amount,
    ROW_NUMBER() OVER (
      PARTITION BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type IN ('project_expense', 'contract_labor')
    AND source_active = true
) ranked
WHERE rn > 1;


-- Query 3: Sample duplicate groups (see actual records that would be affected)
WITH duplicate_groups AS (
  SELECT 
    source_entity_id,
    fee_amount,
    expense_date,
    vendor_name,
    project_number,
    COUNT(*) as dupe_count,
    ARRAY_AGG(id ORDER BY created_at) as ids,
    ARRAY_AGG(source_line_id ORDER BY created_at) as line_ids,
    ARRAY_AGG(created_at::DATE ORDER BY created_at) as created_dates
  FROM public.project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type IN ('project_expense', 'contract_labor')
    AND source_active = true
  GROUP BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
  HAVING COUNT(*) > 1
)
SELECT 
  source_entity_id as "QB Transaction",
  project_number as "Project",
  vendor_name as "Vendor",
  expense_date::DATE as "Date",
  fee_amount as "Amount",
  dupe_count as "# Copies",
  line_ids as "Line IDs (shows index shift)",
  ids as "Record IDs"
FROM duplicate_groups
ORDER BY dupe_count DESC, project_number
LIMIT 30;


-- Query 4: Verify the pattern - check if line_ids follow the "line_N" pattern
SELECT 
  source_line_id,
  COUNT(*) as occurrences,
  source_line_id ~ '^line_\d+$' as is_generated_line_id
FROM public.project_expenses
WHERE source_system = 'qbo'
  AND source_entity_type IN ('project_expense', 'contract_labor')
  AND source_active = true
GROUP BY source_line_id
ORDER BY occurrences DESC
LIMIT 20;


-- Query 5: Check for timestamps that reveal race conditions
-- If duplicates were created at the EXACT same time, that's a race condition
-- If they were created hours/days apart, that's the line-index shift bug
SELECT 
  source_entity_id,
  project_number,
  fee_amount,
  ARRAY_AGG(created_at ORDER BY created_at) as creation_times,
  MAX(created_at) - MIN(created_at) as time_between_duplicates
FROM public.project_expenses
WHERE source_system = 'qbo'
  AND source_entity_type IN ('project_expense', 'contract_labor')
  AND source_active = true
  AND (source_entity_id, fee_amount, expense_date, vendor_name, project_number) IN (
    SELECT source_entity_id, fee_amount, expense_date, vendor_name, project_number
    FROM public.project_expenses
    WHERE source_system = 'qbo'
      AND source_entity_type IN ('project_expense', 'contract_labor')
      AND source_active = true
    GROUP BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
    HAVING COUNT(*) > 1
  )
GROUP BY source_entity_id, project_number, fee_amount
ORDER BY time_between_duplicates DESC
LIMIT 20;
