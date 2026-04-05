# Financial Module

**THE** canonical source for all project financial calculations in IRIS.

## Purpose

Master Plan §1.2 requires ONE place for financial calculations to prevent:
- Inconsistent numbers across dashboards
- "Why does this page show different profit?"
- Ad-hoc queries scattered throughout the codebase

## Core Function

### `computeProjectFinancials(projectId, supabase)`

The primary function that computes ALL financial metrics for a project by querying the database.

**Usage:**

```typescript
import { computeProjectFinancials } from '@/lib/financial'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()
const financials = await computeProjectFinancials('42', supabase)

console.log({
  revenue: financials.revenue,           // $150,000
  laborCost: financials.laborCost,       // $40,000
  expenseCost: financials.expenseCost,   // $10,000
  totalCost: financials.totalCost,       // $50,000
  profit: financials.profit,             // $100,000
  multiplier: financials.multiplier,     // 3.0x
  profitMargin: financials.profitMargin  // 66.67%
})
```

## What's Included

### Revenue
- **Source:** `invoice_line_items` table
- **Calculation:** Sum of ALL invoice line items
- **No exclusions** (includes labor, reimbursables, adjustments)

### Labor Cost
- **Source:** `time_entries` table
- **Calculation:** Sum of ALL `labor_cost` values
- **Includes:** All time entries (billable and non-billable)

### Expense Cost
- **Source:** `project_expenses` table
- **Calculation:** Sum of `fee_amount` for active sources
- **Includes:** Both billable and non-billable expenses
- **Excludes:** Expenses from inactive sources (source_active = false)

### Total Cost
- `laborCost + expenseCost`

### Profit
- `revenue - totalCost`

### Multiplier
- `revenue / totalCost` (0 if totalCost = 0)
- **Industry Target:** 2.5 - 3.5 for engineering firms

### Profit Margin
- `(profit / revenue) × 100` (0 if revenue = 0)
- **Industry Target:** 50-65% for engineering consulting

## Edge Cases Handled

✅ **No invoices** → revenue = 0  
✅ **No time entries** → laborCost = 0  
✅ **No expenses** → expenseCost = 0  
✅ **Zero cost** → multiplier = 0 (avoids division by zero)  
✅ **Zero revenue** → profitMargin = 0 (avoids division by zero)  
✅ **Invalid project ID** → throws Error  
✅ **Project not found** → throws Error  
✅ **Database query failures** → throws Error with context  

## Error Handling

The function throws descriptive errors:

```typescript
try {
  const financials = await computeProjectFinancials('invalid', supabase)
} catch (error) {
  // Error: Invalid project ID: invalid
  // Error: Project not found: 999
  // Error: Failed to fetch invoice data: [details]
}
```

## Testing

Run the TypeScript build to validate:

```bash
npm run build
```

## Files

- **`computeProjectFinancials.ts`** - Main database query function
- **`metrics.ts`** - Pure calculation functions (no DB queries)
- **`index.ts`** - Barrel exports for easy importing

## Migration Guide

**Before (scattered queries):**

```typescript
// ❌ Ad-hoc query in component
const { data: invoices } = await supabase
  .from('invoice_line_items')
  .select('amount')
  .eq('project_number', projectNumber)

const revenue = invoices.reduce((sum, inv) => sum + inv.amount, 0)
```

**After (canonical function):**

```typescript
// ✅ Use the canonical function
const financials = await computeProjectFinancials(projectId, supabase)
const revenue = financials.revenue
```

## Rules

1. **ALL financial displays MUST use this function**
2. **NO ad-hoc financial queries in components or API routes**
3. **If you need different metrics, ADD them here** (don't calculate elsewhere)
4. **Update this README when adding new metrics**

---

*Master Plan §1.2 Compliance: This module is the single source of truth for project financials.*
