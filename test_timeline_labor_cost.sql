-- Test Timeline-Based Labor Cost Lookup
-- This simulates what the API does when creating a timesheet entry

-- Step 1: Check current timeline assignments
SELECT 
  employee_name,
  title,
  effective_from,
  effective_to,
  labor_cost_rate,
  CASE 
    WHEN effective_to IS NULL THEN 'CURRENT'
    WHEN effective_to >= CURRENT_DATE THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END as status
FROM employee_title_history
ORDER BY employee_name, effective_from DESC;

-- Step 2: Test lookup for a specific employee and date
-- (This is what the API does)
SELECT 
  employee_name,
  title,
  labor_cost_rate,
  effective_from,
  effective_to,
  'For entry_date: 2026-04-05' as test_scenario
FROM employee_title_history
WHERE employee_id = (SELECT id::text FROM profiles WHERE email = 'aray@blackstoneeng.com')
  AND effective_from <= '2026-04-05'
  AND (effective_to IS NULL OR effective_to >= '2026-04-05')
ORDER BY effective_from DESC
LIMIT 1;

-- Step 3: Simulate labor_cost calculation
-- Example: 5 hours entry on 2026-04-05
WITH test_entry AS (
  SELECT 
    5.0 as hours,
    '2026-04-05'::date as entry_date,
    (SELECT id::text FROM profiles WHERE email = 'aray@blackstoneeng.com') as employee_id
),
timeline_rate AS (
  SELECT labor_cost_rate
  FROM employee_title_history
  WHERE employee_id = (SELECT employee_id FROM test_entry)
    AND effective_from <= (SELECT entry_date FROM test_entry)
    AND (effective_to IS NULL OR effective_to >= (SELECT entry_date FROM test_entry))
  ORDER BY effective_from DESC
  LIMIT 1
)
SELECT 
  te.hours,
  te.entry_date,
  COALESCE(tr.labor_cost_rate, 0) as cost_rate,
  te.hours * COALESCE(tr.labor_cost_rate, 0) as calculated_labor_cost
FROM test_entry te
LEFT JOIN timeline_rate tr ON true;
