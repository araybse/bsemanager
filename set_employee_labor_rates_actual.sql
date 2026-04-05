-- Set employee labor cost rates based on QB Time historical data
-- Austin can modify these later in Settings UI

BEGIN;

-- Austin Ray - Based on QB Time: $74.60/hour (most recent)
UPDATE employee_title_history
SET labor_cost_rate = 74.60,
    updated_at = now()
WHERE employee_name = 'Austin Ray' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Austin Burke - Based on QB Time: $72.00/hour (2026 current rate)
UPDATE employee_title_history
SET labor_cost_rate = 72.00,
    updated_at = now()
WHERE employee_name = 'Austin Burke' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Wesley Koning - Based on QB Time: $72.61/hour (2026 current rate)
UPDATE employee_title_history
SET labor_cost_rate = 72.61,
    updated_at = now()
WHERE employee_name = 'Wesley Koning' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Arber Meta - Based on QB Time: $60.94/hour (only rate since hired)
UPDATE employee_title_history
SET labor_cost_rate = 60.94,
    updated_at = now()
WHERE employee_name = 'Arber Meta' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Morgan Wilson - Austin specified: $75.00/hour (QB showed $0, Austin corrected)
UPDATE employee_title_history
SET labor_cost_rate = 75.00,
    updated_at = now()
WHERE employee_name = 'Morgan Wilson' 
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

-- Verify changes
SELECT 
  employee_name,
  title,
  effective_from,
  effective_to,
  labor_cost_rate as "Cost Rate ($/hr)",
  CASE 
    WHEN effective_to IS NULL THEN '✅ CURRENT'
    WHEN effective_to >= CURRENT_DATE THEN '✅ ACTIVE'
    ELSE '⚠️ EXPIRED'
  END as status
FROM employee_title_history
WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE
ORDER BY employee_name, effective_from DESC;

COMMIT;
