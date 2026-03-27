# Financial Definitions - Frozen ❄️

## Overview

**THE canonical definitions for all financial metrics in IRIS.**

These formulas are now **FROZEN** - any changes require explicit approval and documentation. This ensures everyone sees the same numbers everywhere.

---

## The Problem We Solved

### Before ❌
```typescript
// Dashboard.tsx
const profit = revenue - (laborCost + expenses)

// Reports.tsx  
const profit = totalInvoiced - totalHours * avgRate

// Projects.tsx
const profit = billedAmount - (directCost + overhead)

// Result: Three different "profit" numbers! 🤯
```

### After ✅
```typescript
// EVERYWHERE in the app
import { calculateProjectFinancials } from '@/lib/financial/metrics'

const financials = calculateProjectFinancials({...})
// financials.profit is the same everywhere! ✨
```

---

## Core Definitions

### 1. **REVENUE** 💰

**What it is:** Total money received (or invoiced) for a project.

**Formula:**
```
Revenue = Invoiced Labor + Invoiced Reimbursables + Lump Sum Payments
```

**Includes:**
- ✅ All invoiced labor (billable hours × rates)
- ✅ Reimbursable expenses with markup (e.g., $100 expense → $115 invoiced)
- ✅ Lump sum payments (fixed-fee portions)

**Excludes:**
- ❌ Unbilled time (not yet invoiced)
- ❌ Pending reimbursables (not yet invoiced)
- ❌ Contract value (that's potential, not actual revenue)

**Why this matters:** Revenue is what you've actually earned and can use for payroll, expenses, etc.

---

### 2. **COST** 💸

**What it is:** Total direct costs incurred on a project.

**Formula:**
```
Cost = Labor Cost + Expense Cost + Contract Labor Cost
```

**Includes:**
- ✅ All labor (hours × employee cost rate) - whether billed or not
- ✅ Reimbursable expenses (actual cost, not marked-up amount)
- ✅ Contract labor / subcontractors
- ✅ Direct materials or services

**Excludes:**
- ❌ Overhead (rent, insurance, general admin)
- ❌ Unbillable time (internal meetings, training)
- ❌ Owner's salary (unless directly assigned to project)

**Why this matters:** Cost is what it actually cost you to deliver the project.

---

### 3. **PROFIT** 📈

**What it is:** Money left over after covering direct costs.

**Formula:**
```
Profit = Revenue - Cost
```

**Note:** This is **GROSS profit** (before overhead allocation).

For **NET profit**, you'd need to:
```
Net Profit = Gross Profit - Allocated Overhead
```

**Why this matters:** Profit shows whether a project made or lost money.

---

### 4. **MULTIPLIER** 📊

**What it is:** How many dollars of revenue you generate per dollar of cost.

**Formula:**
```
Multiplier = Revenue ÷ Cost
```

**Examples:**
- `3.0x` = $3 revenue for every $1 cost → **Great!** 🎉
- `2.0x` = $2 revenue for every $1 cost → **Good** ✅
- `1.5x` = $1.50 revenue for every $1 cost → **Okay** ⚠️
- `0.8x` = $0.80 revenue for every $1 cost → **Losing money!** ❌

**Industry Target:** 2.5x - 3.5x for civil engineering consulting

**Why this matters:** Multiplier is the easiest way to spot profitable vs. unprofitable work.

---

### 5. **MARGIN** 📉

**What it is:** Profit as a percentage of revenue.

**Formula:**
```
Margin = (Revenue - Cost) / Revenue × 100
```

**Examples:**
- `60% margin` = Keeping 60¢ of every dollar earned → **Great!** 🎉
- `50% margin` = Keeping 50¢ of every dollar earned → **Good** ✅
- `30% margin` = Keeping 30¢ of every dollar earned → **Okay** ⚠️
- `-10% margin` = Losing 10¢ on every dollar earned → **Bad!** ❌

**Industry Target:** 50-65% for engineering consulting

**Why this matters:** Margin shows efficiency - high margin means you're lean and profitable.

---

## Usage Examples

### Dashboard - Project Overview

```typescript
import { calculateProjectFinancials, formatCurrency, formatMultiplier } from '@/lib/financial/metrics'

const financials = calculateProjectFinancials({
  invoicedLabor: 150000,
  invoicedReimbursables: 5000,
  lumpSumPayments: 0,
  laborCost: 55000,
  expenseCost: 4500,
  contractLaborCost: 10000
})

console.log(formatCurrency(financials.revenue))  // "$155,000.00"
console.log(formatCurrency(financials.cost))     // "$69,500.00"
console.log(formatCurrency(financials.profit))   // "$85,500.00"
console.log(formatMultiplier(financials.multiplier)) // "2.23x"
console.log(`${financials.margin.toFixed(1)}%`)  // "55.2%"
```

### Phase Analysis

```typescript
import { calculatePhaseFinancials } from '@/lib/financial/metrics'

const designPhase = calculatePhaseFinancials({
  phaseName: 'Design',
  hours: 120,
  invoicedAmount: 18000,
  laborCost: 7200,
  expenseCost: 500
})

console.log(designPhase.multiplier) // 2.34x
console.log(designPhase.profit)     // $10,300
```

### UI Color Indicators

```typescript
import { getMultiplierColor, getMarginColor } from '@/lib/financial/metrics'

const multiplierColor = getMultiplierColor(2.8) // 'success' (green)
const marginColor = getMarginColor(45)          // 'warning' (yellow)

// Use in UI:
// <Badge color={multiplierColor}>2.8x</Badge>
```

---

## Common Scenarios

### Scenario 1: Project in Progress

**Q:** We've done $50K of work but only invoiced $30K. What's our profit?

**A:** Your **accrued profit** (work done) is different from **realized profit** (invoiced).

```typescript
// Realized (cash basis)
const realized = calculateProjectFinancials({
  invoicedLabor: 30000,
  invoicedReimbursables: 0,
  lumpSumPayments: 0,
  laborCost: 20000,
  expenseCost: 0,
  contractLaborCost: 0
})
// realized.profit = $10,000

// Accrued (work done)
const accrued = calculateProjectFinancials({
  invoicedLabor: 50000, // Theoretical if billed
  invoicedReimbursables: 0,
  lumpSumPayments: 0,
  laborCost: 20000,
  expenseCost: 0,
  contractLaborCost: 0
})
// accrued.profit = $30,000
```

IRIS shows **realized** (cash basis) by default.

### Scenario 2: Comparing Projects

**Q:** Which project was more profitable?

```typescript
const projectA = { revenue: 100000, cost: 40000 } // $60K profit, 2.5x
const projectB = { revenue: 50000, cost: 15000 }  // $35K profit, 3.33x

// Project A made more money ($60K > $35K)
// But Project B was more efficient (3.33x > 2.5x)
```

Use **profit** for absolute return, **multiplier** for efficiency.

### Scenario 3: Losing Money

**Q:** Why is my multiplier 0.9x?

**A:** You spent more than you earned!

```typescript
const badProject = calculateProjectFinancials({
  invoicedLabor: 45000,
  invoicedReimbursables: 0,
  lumpSumPayments: 0,
  laborCost: 50000, // Whoops! Cost more than revenue
  expenseCost: 0,
  contractLaborCost: 0
})
// multiplier = 0.9x (losing money!)
// profit = -$5,000 (negative)
```

---

## What Changed?

These definitions are now **enforced** across IRIS:

| Metric | Before | After |
|--------|--------|-------|
| Revenue | Inconsistent | `calculateRevenue()` |
| Cost | Varied by page | `calculateCost()` |
| Profit | Multiple formulas | `calculateProfit()` |
| Multiplier | Sometimes wrong | `calculateMultiplier()` |
| Margin | Rarely shown | `calculateMargin()` |

**Result:** Same numbers everywhere. No more confusion!

---

## FAQs

### Q: What about overhead?

**A:** These are **GROSS** metrics (before overhead). For NET profit:

```typescript
const grossProfit = calculateProfit(revenue, cost)
const overheadAllocation = cost * 0.30 // Example: 30% overhead
const netProfit = grossProfit - overheadAllocation
```

Overhead allocation is complex and project-specific, so we don't include it in the base formulas.

### Q: Why not include unbilled time in revenue?

**A:** Because it's not **realized** revenue yet. We use cash basis accounting. Unbilled time is tracked separately as "work in progress" (WIP).

### Q: Can I change these formulas?

**A:** No! These are **FROZEN**. If you need a different calculation:
1. Create a NEW function (e.g., `calculateNetProfit()`)
2. Document it clearly
3. Don't modify the existing functions

### Q: What if I need project-specific adjustments?

**A:** Apply adjustments AFTER calculating base metrics:

```typescript
const base = calculateProjectFinancials({...})

// Apply project-specific adjustment
const adjusted = {
  ...base,
  profit: base.profit - specialDiscount,
  multiplier: calculateMultiplier(base.revenue, base.cost + specialDiscount)
}
```

---

## Migration Checklist

- [ ] Update dashboard to use `calculateProjectFinancials()`
- [ ] Update reports to use financial metrics functions
- [ ] Update project detail pages
- [ ] Update invoice generation (if using profit calculations)
- [ ] Remove any custom profit/multiplier calculations
- [ ] Add unit tests for edge cases
- [ ] Train team on new definitions

---

## Summary

✅ **One formula for each metric**  
✅ **Clear includes/excludes**  
✅ **Industry-standard targets**  
✅ **Consistent formatting**  
✅ **FROZEN** (no more changes without approval)

**Result:** Everyone speaks the same financial language! 🎉

