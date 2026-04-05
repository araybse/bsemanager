-- Quick setup: Set employee labor cost rates in timeline assignments
-- Run this before Monday launch to enable labor cost calculations

BEGIN;

-- Update labor cost rates for current (active) timeline assignments
-- These are COST rates (what it costs the company), not billable rates

-- Austin Ray - Principal Engineer (Owner)
UPDATE employee_title_history
SET labor_cost_rate = 150.00,  -- Adjust this to actual cost
    updated_at = now()
WHERE employee_name = 'Austin Ray' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Austin Burke - Project Manager
UPDATE employee_title_history
SET labor_cost_rate = 85.00,   -- Adjust this to actual cost
    updated_at = now()
WHERE employee_name = 'Austin Burke' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Wesley Koning - Project Manager
UPDATE employee_title_history
SET labor_cost_rate = 85.00,   -- Adjust this to actual cost
    updated_at = now()
WHERE employee_name = 'Wesley Koning' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Arber Meta - Senior Designer
UPDATE employee_title_history
SET labor_cost_rate = 65.00,   -- Adjust this to actual cost
    updated_at = now()
WHERE employee_name = 'Arber Meta' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Morgan Wilson - Project Inspector
UPDATE employee_title_history
SET labor_cost_rate = 50.00,   -- Adjust this to actual cost
    updated_at = now()
WHERE employee_name = 'Morgan Wilson' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Verify changes
SELECT 
  employee_name,
  title,
  effective_from,
  effective_to,
  labor_cost_rate,
  CASE 
    WHEN effective_to IS NULL THEN '✅ CURRENT'
    WHEN effective_to >= CURRENT_DATE THEN '✅ ACTIVE'
    ELSE '⚠️ EXPIRED'
  END as status
FROM employee_title_history
WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE
ORDER BY employee_name, effective_from DESC;

COMMIT;

-- To rollback if needed: ROLLBACK;
