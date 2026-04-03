# Cash Flow - Services Revenue Logic

## Overview
The Services section in Cash Flow now correctly represents expected cash receipts by month, with full project → phase breakdown.

---

## Logic by Month Type

### **Current Month (e.g., April 2026)**

**Shows:** Outstanding A/R (unpaid invoices issued BEFORE current month)

**Calculation:**
- Source: All unpaid invoices with `date_issued < current_month_start` AND `date_paid IS NULL`
- Excludes: Reimbursables and Adjustments (line_type filtering)
- Broken down by: Project → Phase (from invoice line items)

**Example April 2026:**
```
Services                                   $151,410
  ├─ 23-01 Adventure Retail                   $573
  │   └─ Final Certs & Construction Obs.      $573  ← A/R
  ├─ 25-08 US 1 Flex Space                 $31,293
  │   └─ Permitting                        $31,293  ← A/R
  ...
```

**Manual forecasts for current month are IGNORED** - only A/R backlog is shown.

---

### **Next Month (e.g., May 2026)**

**Shows:** Either actual invoices from current month OR manual forecast

**Logic:**
```javascript
IF (invoices issued in April exist) {
  Show: Sum of invoice line items issued in April
  Breakdown: By project → phase from those invoices
} ELSE {
  Show: Manual forecasts from cash_flow_phase_forecasts
  Breakdown: By project → phase from forecast table
}
```

**Scenario A: No April invoices issued yet**
```
Services                                    $68,276
  ├─ 26-03 Tier1 Nocatee                  $19,750
  │   ├─ Engineering Plan Preparation     $17,250  ← Manual forecast
  │   └─ MDP/PUD VSC                       $2,500  ← Manual forecast
  ...
```

**Scenario B: April invoices issued ($85K)**
```
Services                                    $85,000
  ├─ 25-08 US 1 Flex Space                $12,000
  │   └─ Permitting                       $12,000  ← From April invoice
  ├─ 26-03 Tier1 Nocatee                  $20,000
  │   └─ Engineering Plan Preparation     $20,000  ← From April invoice
  ...
```

**Key Point:** Once you issue invoices in April, May's manual forecasts are overridden by actual invoice amounts.

---

### **Future Months (June 2026+)**

**Shows:** Manual forecasts only

**Source:** `cash_flow_phase_forecasts` table
- `forecast_month = target_month`
- Broken down by project → phase

**Example June 2026:**
```
Services                                    $70,000
  ├─ 25-18 Kayla's Landing                 $8,000
  │   ├─ Permitting                        $5,000  ← Manual forecast
  │   └─ Engineering Plan Preparation      $3,000  ← Manual forecast
  ...
```

---

## Code Implementation

**File:** `src/app/(authenticated)/cash-flow/page.tsx`

**Key Changes (Line ~888):**

```typescript
// Check if any invoices were issued in current month
const hasCurrentMonthInvoices = Array.from(invoiceMetaById.values()).some(
  (inv) => (inv.dateIssued || '').slice(0, 7) === currentMonthKey
)

// Process manual forecasts
manualForecastRows.forEach((manualRow) => {
  const forecastMonth = manualRow.forecast_month.slice(0, 7)
  
  // SKIP manual forecasts for current month (only show A/R)
  if (forecastMonth === currentMonthKey) return
  
  // SKIP manual forecasts for next month if invoices were issued in current month
  if (forecastMonth === monthAfterCurrentKey && hasCurrentMonthInvoices) return
  
  // Add forecast to phase totals
  // ...
})
```

---

## Invoice Aging Logic (Unchanged)

Unpaid invoices are projected to their expected payment month:

| Invoice Date | Projected To | Reasoning |
|--------------|-------------|-----------|
| Before current month | **Current month** | Expected to collect now |
| In current month | **Next month** | 30-day payment terms |
| In future month | **That month + 1** | Expected payment cycle |

**This logic remains the same** - only the manual forecast handling changed.

---

## Benefits

1. **Current month is realistic** - Shows only what you're actually expecting to collect (A/R backlog)
2. **Next month adapts** - Uses real invoices when issued, falls back to forecast if not
3. **Full breakdown** - Every project and phase shows the correct source (A/R, invoice, or forecast)
4. **No double-counting** - Manual forecasts don't add to current month A/R
5. **Cleaner projections** - Future months show pure forecasts until invoices issued

---

## Testing

**To verify the fix works:**

1. **Check April 2026 Services:**
   - Should show ~$151K (not $219K)
   - Drill down: Each project/phase shows A/R breakdown

2. **Check May 2026 Services:**
   - If no April invoices: Shows manual forecasts (~$68K)
   - If April invoices exist: Shows those invoice amounts instead

3. **Issue a test invoice in April:**
   - May column should update to reflect the invoice amount
   - Manual May forecast should disappear

---

## Manual Forecast Management

**Where to set forecasts:** Cash Flow page → Click month columns to edit phase forecasts

**Best Practice:**
- Set forecasts 2-3 months out
- Update as you learn more about project timing
- Forecasts auto-override when invoices issued
- No need to manually clear forecasts after invoicing

---

## Future Enhancements

- [ ] Show forecast vs actual variance in completed months
- [ ] Auto-generate forecasts based on contract phase status
- [ ] Alert when A/R aging exceeds thresholds
- [ ] Historical accuracy tracking (forecast vs actual)
