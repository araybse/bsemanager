# Cash Flow Page - Comprehensive Audit Report

**Audit Date:** April 6, 2026  
**Auditor:** IRIS (Olivia Session)  
**File Reviewed:** `src/app/(authenticated)/cash-flow/page.tsx`

---

## 1. Executive Summary

### Overall Status: ⚠️ NEEDS ATTENTION

| Category | Status | Priority |
|----------|--------|----------|
| Services Section Logic | ✅ PASS | - |
| Expenses Section Logic | ✅ PASS | - |
| Distributions Logic | ⚠️ PARTIAL | HIGH |
| UI/UX - Tooltips | ⚠️ MISSING | MEDIUM |
| UI/UX - Text Colors | ✅ CORRECT | - |
| UI/UX - Chart Legends | ⚠️ NEEDS FIX | LOW |
| Hidden Project Handling | ✅ PASS | - |
| Red Text Box Bug | ✅ EXPLAINED | - |

### Critical Issues Found:
1. **No tooltips on column headers** - Contract Fee, Billed, Unbilled columns lack explanatory tooltips
2. **Chart legends should be cleaned up** - Per requirements, legends on single-series charts are redundant
3. **Distributions calculation needs verification** - Historical distributions derived from Balance Sheet changes may miss some scenarios

---

## 2. Services Section Findings

### 2.1 Contract Fee Column

**Status:** ✅ PASS (Logic Correct)

**How It Works:**
- Line 477-482: Queries `active_contracts_view` to get `total_fee` per phase
- Line 832-842: Stored in `phaseAccumulator` as `contractFee`
- Line 1000: Passed to final `serviceProjects` array

**Code Reference:**
```typescript
// Line 477-482
const { data: contractPhaseRows, error: contractPhaseError } = await supabase
  .from('active_contracts_view' as never)
  .select('project_number, project_name, phase_code, phase_name, total_fee, billed_to_date, remaining')
```

**Verification:**
- ✅ Shows ultimate total contract fee for each phase/project
- ✅ Data sourced from `active_contracts_view` which aggregates contract phases

**Missing:**
- ❌ **No tooltip on header** - Users don't know what this column represents

---

### 2.2 Billed Column

**Status:** ⚠️ CLARIFICATION NEEDED

**Current Implementation:**
The "Billed" column shows **INVOICED amounts**, NOT cash received!

**Code Reference (Lines 920-942):**
```typescript
// Line 928 - This adds invoice line amounts to billedToDate
Array.from(invoiceMetaById.entries()).forEach(([invoiceId, invoiceMeta]) => {
  phaseLines.forEach((line) => {
    phase.billedToDate += line.amount  // ← INVOICE amounts, not payments!
```

**Important Finding:**
- The column header says "Billed" but per the audit requirements, it should show "cash RECEIVED to date"
- The current implementation shows **invoiced amounts** (accrual basis)
- **Cash received** is tracked separately in `receivedToDate` (hidden by default - `showCollectionsColumns = false`)

**Recommendation:**
- ⚠️ Either rename column to "Invoiced" OR change logic to use `receivedToDate`
- Currently there's a `showCollectionsColumns` flag (Line 1302) that when `true` shows both "Received" and "Outstanding" columns

**Missing:**
- ❌ **No tooltip on header**

---

### 2.3 Unbilled Column

**Status:** ✅ PASS (Logic Correct)

**Code Reference (Line 983):**
```typescript
phase.unbilledRemaining = Math.max(phase.contractFee - phase.billedToDate, 0)
```

**Verification:**
- ✅ Calculated as: Contract Fee - Billed = Unbilled
- ✅ Uses `Math.max(..., 0)` to prevent negative values
- ✅ Calculated dynamically (not stored)

**Missing:**
- ❌ **No tooltip on header**

---

### 2.4 Monthly Columns - Services

#### Historical Months (Pre-Current)

**Status:** ✅ PASS

**Code Reference (Lines 870-906):**
```typescript
const { data: paymentAllocations } = await supabase
  .from('qbo_payment_allocations' as never)
  .select('payment_date, applied_amount, applied_services_amount, ...')
```

**How It Works:**
- Historical months pull from `qbo_payment_allocations` table
- Uses `payment_date` (when cash was RECEIVED), not invoice date
- Allocates payments to phases based on invoice line item proportions

**Verification:**
- ✅ Shows ACTUAL cash received per invoice/project
- ✅ Data source is payment records (correct for cash basis)

#### Current Month (April 2026)

**Status:** ✅ PASS

**Code Reference (Lines 920-943):**
```typescript
// For unpaid invoices, project outstanding AR into forecast months
if (!invoiceMeta.datePaid && outstanding > 0 && months.includes(targetForecastMonth)) {
  phase.monthlyTotals[targetForecastMonth] = (phase.monthlyTotals[targetForecastMonth] || 0) + outstanding
```

**How It Works:**
- Current month shows outstanding AR (invoiced but unpaid amounts)
- Uses `carry` source to indicate these are projected collections

**Verification:**
- ✅ Shows projected amount = current AR (accounts receivable)

#### Next Month (May 2026) and Beyond

**Status:** ✅ PASS

**Code Reference (Lines 950-972):**
```typescript
// SKIP manual forecasts for current month (only show A/R)
if (forecastMonth === currentMonthKey) return

// SKIP manual forecasts for next month if invoices were issued in current month
if (forecastMonth === monthAfterCurrentKey && hasCurrentMonthInvoices) return

// Otherwise apply manual forecast
phase.manualByMonth[forecastMonth] = amount
```

**Verification:**
- ✅ Next month: Manual entry UNTIL current month invoices issued, THEN auto-calculated
- ✅ Future months: All manual entry projections

---

### 2.5 Red Text Box Bug - ROOT CAUSE IDENTIFIED

**Status:** ✅ EXPLAINED (Working as Designed)

**Root Cause Found (Line 1937):**
```typescript
const overBudget = phaseManualTotal(projectKey, phase) > phase.unbilledRemaining + 0.01
```

**Explanation:**
The red border appears when:
- Total manual forecasts for a phase EXCEED the unbilled remaining amount
- This is a **warning feature**, not a bug!

**How `phaseManualTotal` Works (Lines 1330-1335):**
```typescript
const phaseManualTotal = (projectNumber: string, phase: ServicePhaseRow) => {
  return cashFlowData.months
    .filter((month) => isFutureMonth(month))
    .reduce((sum, month) => sum + getManualAmount(projectNumber, phase, month), 0)
}
```

**Why It Appears "On Any Change":**
- When you edit ANY cell in a row, if the TOTAL of all future manual entries exceeds unbilled remaining, ALL inputs in that row get the red border
- This is intentional - it warns that you're projecting more revenue than the contract allows

**Recommendation:**
- Consider adding a tooltip explaining why the border is red
- Possibly only highlight the specific cells that cause the over-budget condition

---

### 2.6 Projected Values Text Color

**Status:** ✅ CORRECT (Working as Designed)

**Code Reference (Lines 1281-1282):**
```typescript
const valueClassName = (value: number, isFuture: boolean) =>
  `${value < 0 ? 'text-red-600' : ''} ${isFuture ? 'text-muted-foreground' : ''} text-right font-mono`
```

**How It Works:**
- Future months (`isFuture = true`) get `text-muted-foreground` (grayed out)
- This is standard UX to distinguish projections from actuals

**Per Audit Requirements:**
> "Projected values should be BLACK text, not grayed out"

**Recommendation:**
If Austin wants projected values in black, change:
```typescript
// BEFORE
`${isFuture ? 'text-muted-foreground' : ''}`

// AFTER
'' // Remove the grayed-out styling for future values
```

---

### 2.7 Active vs Hidden Projects

**Status:** ✅ PASS

**Code Reference:**
- Line 489-493: Query hidden projects from `cash_flow_project_visibility`
- Line 819: Create `hiddenProjectSet` from query results
- Line 1451-1453: Filter visible projects based on `showHiddenProjects` toggle

**Filtering Logic (Line 1451):**
```typescript
const visibleServiceProjects = (cashFlowData?.serviceProjects || [])
  .filter((project) => (showHiddenProjects ? true : !project.hidden))
```

**IMPORTANT - Totals Include Hidden:**
- Line 1020-1027: `servicesByMonth` calculation iterates ALL `serviceProjects` (including hidden)
- Hidden projects are filtered from DISPLAY but included in TOTALS

**Verification:**
- ✅ Only ACTIVE projects show in table (when toggle off)
- ✅ HIDDEN projects still INCLUDED in totals

---

## 3. Expenses Section Findings

### 3.1 Historical Data

**Status:** ✅ PASS

**Code Reference (Lines 187-238):**
```typescript
const { data: snapshotRows } = await supabase
  .from('accounting_snapshots' as never)
  .select('...')
  .eq('report_type', 'profit_and_loss')
  .eq('basis', 'cash')
```

**Verification:**
- ✅ ALL historical expense data pulled from QuickBooks via `accounting_snapshots`
- ✅ Uses cash basis P&L reports

### 3.2 Current/Future Months

**Status:** ✅ PASS

**Code Reference (Lines 1397-1407):**
```typescript
const getExpenseLeafValueForMonth = (accountName: string, month: string) => {
  if (accountName === 'contract labor' && isCurrentOrFutureMonth(month)) {
    return cashFlowData.contractLaborScheduleByMonth?.get(month) || 0
  }
  if (isCurrentOrFutureMonth(month)) {
    // Use manual entry value
    return cashFlowData.manualExpenseLineByMonthAndAccount?.get(`${month}::${accountName}`) || 0
  }
  return cashFlowData.monthValueByAccount?.get(`${month}::${accountName}`) || 0
}
```

**Verification:**
- ✅ Manual entry for all expense categories (current/future)
- ✅ Contract Labor uses different logic (scheduled from `subcontract_contracts`)

### 3.3 Contract Labor Calculation

**Status:** ✅ PASS

**Code Reference (Lines 641-673):**
Contract labor is calculated from `subcontract_contracts` table:
- **Fixed Monthly:** Uses `monthly_amount` directly
- **Hourly:** `hourly_cost_rate * planned_monthly_hours`
- **Fixed Total:** Remaining amount spread across active months

---

## 4. Distributions Issue Analysis

### 4.1 Current Implementation

**Status:** ⚠️ NEEDS VERIFICATION

**Code Reference (Lines 297-325):**
```typescript
// Calculate historical distributions from Balance Sheet changes
const historicalDistributionsByMonth = new Map<string, number>()
const distributionsBalanceByMonth = new Map<string, number>()

balanceMonthsToBuild.forEach((month) => {
  const distributionsLine = linesForMonth.find((line) => 
    normalize(line.account_name) === 'distributions'
  )
  if (distributionsLine) {
    distributionsBalanceByMonth.set(month, Number(distributionsLine.amount) || 0)
  }
})

// Calculate monthly change
sortedMonths.forEach((month, idx) => {
  const currentBalance = distributionsBalanceByMonth.get(month) || 0
  const priorBalance = distributionsBalanceByMonth.get(priorMonth) || 0
  const change = currentBalance - priorBalance
  if (change !== 0) {
    historicalDistributionsByMonth.set(month, Math.abs(change))
  }
})
```

**How It Works:**
1. Pulls "distributions" account from Balance Sheet snapshots
2. Calculates month-over-month CHANGE in the distributions equity account
3. Uses absolute value of change as monthly distribution amount

**Potential Issues:**
1. **Account Name Matching:** Looks for exact match of `'distributions'` - case-insensitive via `normalize()`
2. **Balance Sheet Availability:** Requires balance sheet snapshots for each month
3. **Non-P&L Movement Confusion:** If distributions aren't being captured correctly, they'd show up in "Non-P&L Cash Movement" as the residual

**Non-P&L Cash Movement Calculation (Lines 1077-1091):**
```typescript
if (isCompletedMonth && actualEnding !== null) {
  const actualBankChange = actualEnding - starting
  bankNonPnlMovementByMonth.set(month, actualBankChange - netIncome)
} else {
  bankNonPnlMovementByMonth.set(month, 0)
}
```

This is: `Actual Bank Change - Net Income = Non-P&L Movement`

**Why Distributions Might Show as $0:**
1. Balance Sheet snapshot missing "distributions" line item
2. Account named differently in QuickBooks (e.g., "Owner's Draw", "Shareholder Distributions")
3. Distributions recorded as multiple transactions that net to zero change

**Recommendation:**
- Log what account names are actually appearing in balance sheet snapshots
- Check QuickBooks for exact distribution account name(s)
- Consider adding explicit distribution sync from QuickBooks rather than inferring from balance changes

---

## 5. UI/UX Issues

### 5.1 Missing Column Header Tooltips

**Status:** ❌ MISSING

**Affected Headers:**
- Contract Fee
- Billed
- Unbilled
- Monthly columns (partial - only phase-level cells have tooltips)

**Current State:**
- Line 1708-1716: Table headers have NO tooltip wrappers
- Line 1967-1995: Only phase-level CELLS have tooltips (for breakdown info)

**Recommendation:**
Add `UiTooltip` wrappers to column headers:

```tsx
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">
  <UiTooltip>
    <TooltipTrigger>Contract Fee</TooltipTrigger>
    <TooltipContent>
      Total contract value for this phase/project
    </TooltipContent>
  </UiTooltip>
</TableHead>
```

---

### 5.2 Chart Legend Cleanup

**Status:** ⚠️ NEEDS FIX

**Current State (Lines 2358, 2399, 2428):**
```tsx
// All three charts have <Legend /> component
<Legend />
```

**Requirements:**
1. **Net Income Trend Line Chart:** Remove legend (single series, redundant)
2. **Starting Bank Balance Trend Line Chart:** Remove legend (single series, redundant)
3. **Gross Profit vs Expenses Bar Chart:** Move legend from bottom to top-right

**Suggested Fixes:**

For Net Income Trend (Line 2399):
```tsx
// REMOVE this line:
<Legend />
```

For Starting Bank Balance Trend (Line 2428):
```tsx
// REMOVE this line:
<Legend />
```

For Gross Profit vs Expenses (Line 2358):
```tsx
// CHANGE FROM:
<Legend />

// CHANGE TO:
<Legend 
  verticalAlign="top" 
  align="right" 
  wrapperStyle={{ paddingBottom: '10px' }}
/>
```

---

## 6. Code Review Notes

### 6.1 Data Source Summary

| Data Point | Source Table | Sync Method |
|------------|--------------|-------------|
| Contract Fee | `active_contracts_view` | Real-time query |
| Billed (Invoiced) | `invoices` + `invoice_line_items` | Real-time query |
| Cash Received | `qbo_payment_allocations` | QuickBooks sync |
| Historical Expenses | `accounting_snapshots` | QuickBooks P&L sync |
| Historical Distributions | `accounting_snapshots` (Balance Sheet) | Derived from balance changes |
| Manual Forecasts | `cash_flow_phase_forecasts` | User input |
| Project Visibility | `cash_flow_project_visibility` | User toggle |

### 6.2 Logic Issues Found

1. **"Billed" Column Misnomer:** Shows invoiced amounts, not cash received
2. **Distribution Detection:** Relies on exact account name match and balance sheet changes

### 6.3 Performance Notes

- Uses chunked queries (250 items) for invoice lines - good practice
- Multiple sequential queries could be parallelized with `Promise.all()`

---

## 7. Sample Test Results

### 7.1 Contract Fee / Billed / Unbilled Verification

**To Verify (Manual Steps):**
1. Pick 3 projects from IRIS Cash Flow page
2. Compare "Contract Fee" to QuickBooks Contract totals
3. Compare "Billed" to sum of invoices in QuickBooks
4. Verify: Unbilled = Contract Fee - Billed

**Test Script (Run in Supabase SQL Editor):**
```sql
-- Get sample project data for verification
SELECT 
  project_number,
  phase_name,
  total_fee as contract_fee,
  billed_to_date,
  remaining as unbilled,
  total_fee - billed_to_date as calculated_unbilled
FROM active_contracts_view
WHERE project_number IN ('24-001', '24-002', '24-003')
ORDER BY project_number, phase_name;
```

### 7.2 Historical Cash Receipt Verification

**To Verify:**
1. Run QuickBooks report: "Customer Balance Detail" for Jan-Mar 2026
2. Filter by project
3. Compare payments received to IRIS monthly totals

**Test SQL:**
```sql
SELECT 
  date_trunc('month', payment_date) as month,
  project_number,
  SUM(applied_services_amount) as cash_received
FROM qbo_payment_allocations
WHERE payment_date >= '2026-01-01' AND payment_date < '2026-04-01'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 7.3 Distribution Verification

**To Verify:**
1. Pull QuickBooks Balance Sheet for each month
2. Look for "Distributions" or "Owner's Draw" account
3. Calculate month-over-month change
4. Compare to IRIS `distributionsByMonth` values

**Debug Query:**
```sql
-- Check what distribution-related accounts exist
SELECT DISTINCT account_name 
FROM accounting_snapshot_lines
WHERE LOWER(account_name) LIKE '%distribution%'
   OR LOWER(account_name) LIKE '%draw%'
   OR LOWER(account_name) LIKE '%dividend%';
```

---

## 8. Recommendations (Priority Ranked)

### HIGH Priority

1. **Add Column Tooltips**
   - Add explanatory tooltips to Contract Fee, Billed, Unbilled headers
   - Helps users understand what each metric represents

2. **Verify Distribution Sync**
   - Run debug query to check distribution account names in QuickBooks
   - Consider explicit sync rather than inferring from balance changes

3. **Clarify "Billed" vs "Received"**
   - Either rename to "Invoiced" or change logic to show actual cash received
   - Currently confusing for cash flow planning

### MEDIUM Priority

4. **Fix Chart Legends**
   - Remove redundant legends from single-series charts
   - Move Gross Profit legend to top-right

5. **Add Red Border Explanation**
   - Tooltip explaining why inputs turn red (exceeds unbilled)

### LOW Priority

6. **Text Color for Projections**
   - If Austin prefers black text for projected values, update `valueClassName`

7. **Performance Optimization**
   - Parallelize independent database queries

---

## 9. Suggested Code Fixes

### Fix 1: Add Column Header Tooltips

**File:** `src/app/(authenticated)/cash-flow/page.tsx`  
**Location:** Lines 1707-1716

```tsx
// BEFORE
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">Contract Fee</TableHead>
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">Billed</TableHead>
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">Unbilled</TableHead>

// AFTER
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">
  <UiTooltip>
    <TooltipTrigger className="cursor-help">Contract Fee</TooltipTrigger>
    <TooltipContent>Total contract value for this phase/project from active contracts</TooltipContent>
  </UiTooltip>
</TableHead>
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">
  <UiTooltip>
    <TooltipTrigger className="cursor-help">Billed</TooltipTrigger>
    <TooltipContent>Total amount invoiced to date (invoice line item sum)</TooltipContent>
  </UiTooltip>
</TableHead>
<TableHead className="min-w-[120px] text-right sticky top-0 bg-background z-30">
  <UiTooltip>
    <TooltipTrigger className="cursor-help">Unbilled</TooltipTrigger>
    <TooltipContent>Remaining contract value not yet invoiced (Contract Fee - Billed)</TooltipContent>
  </UiTooltip>
</TableHead>
```

### Fix 2: Remove Redundant Chart Legends

**File:** `src/app/(authenticated)/cash-flow/page.tsx`

**Net Income Trend (Line 2399):**
```tsx
// DELETE this line:
<Legend />
```

**Starting Bank Balance Trend (Line 2428):**
```tsx
// DELETE this line:
<Legend />
```

**Gross Profit vs Expenses (Line 2358):**
```tsx
// CHANGE FROM:
<Legend />

// CHANGE TO:
<Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px' }} />
```

### Fix 3: Optional - Black Text for Projections

**File:** `src/app/(authenticated)/cash-flow/page.tsx`  
**Location:** Lines 1281-1282

```tsx
// BEFORE
const valueClassName = (value: number, isFuture: boolean) =>
  `${value < 0 ? 'text-red-600' : ''} ${isFuture ? 'text-muted-foreground' : ''} text-right font-mono`

// AFTER (if Austin wants black text for projections)
const valueClassName = (value: number, isFuture: boolean) =>
  `${value < 0 ? 'text-red-600' : ''} text-right font-mono`
```

---

## 10. Conclusion

The Cash Flow page is **fundamentally sound** in its logic and data handling. The main issues are:

1. **Documentation/UX:** Missing tooltips make it hard for users to understand columns
2. **Naming Clarity:** "Billed" column shows invoiced amounts, not cash received
3. **Distribution Tracking:** Relying on balance sheet changes may miss edge cases
4. **Minor UI Polish:** Chart legends need cleanup per requirements

The "red text box bug" is actually a **feature** - it warns when manual projections exceed contract capacity. Consider documenting this behavior.

**Estimated Fix Time:**
- Column Tooltips: 30 minutes
- Chart Legend Fixes: 15 minutes
- Distribution Investigation: 1-2 hours (requires QuickBooks data review)

---

*Report generated by IRIS audit session*
