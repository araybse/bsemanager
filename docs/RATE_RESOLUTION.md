# Rate Resolution Engine

## Overview

**THE canonical function for all billing rate lookups in IRIS.**

All rate calculations must use `getApplicableRate()` to ensure:
- ✅ Consistent rate logic across the entire application
- ✅ Clear priority order (overrides > schedules > default)
- ✅ Full audit trail (source tracking + logging)
- ✅ No more "$0 mystery rates"

---

## The Problem We Solved

### Before (❌ Multiple rate sources)

```typescript
// Dashboard: Reads from billable_rates table
const rate1 = await supabase.from('billable_rates').select(...)

// Time entry form: Reads from rate_schedules
const rate2 = await supabase.from('rate_schedules').select(...)

// Invoice generation: Custom calculation
const rate3 = calculateRateFromProposal(...)

// Result: Different pages show different rates for same position! 🤯
```

### After (✅ Single source of truth)

```typescript
// EVERYWHERE in the app:
const rate = await getApplicableRate({
  projectId: 123,
  positionTitle: 'Senior Engineer',
  effectiveDate: '2026-03-27'
})
// Result: Same rate everywhere! ✨
```

---

## Rate Priority Order

The function checks these sources in order (first match wins):

### 1. **Project-Specific Override** (Highest Priority)
*Table: `project_rate_position_overrides`*

Use when a project has negotiated custom rates.

**Example:** Project 24-05 pays $150/hr for Senior Engineers (instead of standard $125/hr)

### 2. **Assigned Rate Schedule**
*Tables: `project_rate_schedule_assignments` → `rate_schedule_items`*

Use when a project uses a named rate schedule.

**Example:** Project 24-10 uses "2024 Rate Card" schedule

### 3. **Default Rate Schedule**
*Table: `rate_schedules` (where `is_default = true`)*

Fallback for all projects without custom rates.

**Example:** Standard company rates for all positions

### 4. **Fallback ($0)**
*Error state - logs warning*

Should never happen in production. Indicates missing rate configuration.

---

## Usage

### Basic Usage

```typescript
import { getApplicableRate } from '@/lib/rates/getApplicableRate'

const rate = await getApplicableRate({
  projectId: 123,
  positionTitle: 'Senior Engineer',
  effectiveDate: '2026-03-27'
})

console.log(rate.hourlyRate) // 125.00
console.log(rate.source) // 'rate_schedule'
console.log(rate.rateScheduleName) // '2024 Rate Card'
```

### Batch Lookup (Multiple Positions)

```typescript
import { getApplicableRates } from '@/lib/rates/getApplicableRate'

const rates = await getApplicableRates([
  { projectId: 123, positionTitle: 'Senior Engineer', effectiveDate: '2026-03-27' },
  { projectId: 123, positionTitle: 'Project Manager', effectiveDate: '2026-03-27' },
  { projectId: 124, positionTitle: 'Junior Engineer', effectiveDate: '2026-03-27' }
])

// rates[0].hourlyRate = 125.00
// rates[1].hourlyRate = 150.00
// rates[2].hourlyRate = 85.00
```

### Validation (Before Creating Time Entry)

```typescript
import { validateRateExists } from '@/lib/rates/getApplicableRate'

const validation = await validateRateExists({
  projectId: 123,
  positionTitle: 'Senior Engineer',
  effectiveDate: '2026-03-27'
})

if (!validation.valid) {
  throw new Error(validation.error) // "No billing rate configured..."
}

// Safe to create time entry - rate exists!
const hourlyRate = validation.rate.hourlyRate
```

---

## Response Format

```typescript
interface RateResolutionResult {
  hourlyRate: number // The actual rate (e.g., 125.00)
  source: 'project_override' | 'rate_schedule' | 'default_schedule' | 'fallback'
  sourceId?: number // Database ID of the rate record
  rateScheduleName?: string // "2024 Rate Card"
  effectiveFrom?: string // "2024-01-01"
  effectiveTo?: string | null // "2024-12-31" or null (no end date)
  metadata: {
    projectId: number
    positionTitle: string
    effectiveDate: string
    resolvedAt: string // ISO timestamp of when rate was resolved
    warnings?: string[] // Any resolution issues
  }
}
```

---

## Where To Use This

### ✅ Must Use

1. **Time Entry Creation**
   - Before saving time entry
   - Calculate billable amount

2. **Invoice Generation**
   - Calculate line item totals
   - Show rate on invoice

3. **Project Dashboard**
   - Display current rates
   - Show rate history

4. **Financial Reports**
   - Labor cost calculations
   - Revenue projections

5. **Rate Configuration UI**
   - Show effective rate preview
   - Validate rate coverage

### ❌ Do NOT Use

- When displaying raw rate schedule data (admin configuration screens)
- When showing historical rates from `time_entry_bill_rates` table (already locked)

---

## Integration Examples

### Time Entry Form

```typescript
// src/app/(authenticated)/timesheet/page.tsx

async function handleTimeEntrySubmit(entry: TimeEntryFormData) {
  // 1. Resolve rate
  const rate = await getApplicableRate({
    projectId: entry.projectId,
    positionTitle: entry.position,
    effectiveDate: entry.date
  })

  if (rate.hourlyRate === 0) {
    throw new Error('No billing rate configured for this position')
  }

  // 2. Calculate billable amount
  const billableAmount = entry.hours * rate.hourlyRate

  // 3. Save time entry
  await supabase.from('time_entries').insert({
    project_id: entry.projectId,
    employee_id: user.id,
    entry_date: entry.date,
    hours: entry.hours,
    billable_amount: billableAmount,
    hourly_rate: rate.hourlyRate, // Snapshot rate used
    rate_source: rate.source
  })

  // 4. Save rate snapshot for audit
  await supabase.from('time_entry_bill_rates').insert({
    time_entry_id: result.id,
    resolved_title: entry.position,
    resolved_hourly_rate: rate.hourlyRate,
    rate_source: rate.source,
    rate_source_id: rate.sourceId
  })
}
```

### Invoice Generation

```typescript
// src/lib/invoices/generateInvoice.ts

async function generateInvoiceLineItems(projectId: number, startDate: string, endDate: string) {
  // Get unbilled time entries
  const timeEntries = await getUnbilledTimeEntries(projectId, startDate, endDate)

  // Group by position title
  const byPosition = groupBy(timeEntries, 'position_title')

  const lineItems = []

  for (const [position, entries] of Object.entries(byPosition)) {
    // Get current rate for this position
    const rate = await getApplicableRate({
      projectId,
      positionTitle: position,
      effectiveDate: endDate // Use invoice date
    })

    const totalHours = sum(entries.map(e => e.hours))
    const amount = totalHours * rate.hourlyRate

    lineItems.push({
      description: `${position} - ${totalHours} hours @ $${rate.hourlyRate}/hr`,
      quantity: totalHours,
      rate: rate.hourlyRate,
      amount: amount
    })
  }

  return lineItems
}
```

---

## Logging & Debugging

### Console Output

The function logs to console for debugging:

```
[Rate Resolution] Project override found for Senior Engineer on project 123
[Rate Resolution] Rate schedule "2024 Rate Card" found for PM on project 124
[Rate Resolution] Default schedule found for Junior Engineer
[Rate Resolution] NO RATE FOUND for Intern on project 125 as of 2026-03-27
```

### Database Queries

Check what rate was actually used:

```sql
-- See rate resolution history for a time entry
SELECT 
  te.entry_date,
  te.hours,
  te.hourly_rate,
  tebr.resolved_title,
  tebr.rate_source,
  tebr.rate_source_id,
  tebr.resolved_at
FROM time_entries te
LEFT JOIN time_entry_bill_rates tebr ON te.id = tebr.time_entry_id
WHERE te.id = 12345;
```

---

## Troubleshooting

### "$0 Rate" Issues

**Problem:** Time entries or invoices showing $0 rates

**Solution:**
1. Check rate resolution for that position:
   ```typescript
   const rate = await getApplicableRate({
     projectId: 123,
     positionTitle: 'Senior Engineer',
     effectiveDate: '2026-03-27'
   })
   console.log(rate) // Check warnings array
   ```

2. Verify rate schedule exists:
   ```sql
   SELECT * FROM rate_schedules WHERE is_default = true;
   SELECT * FROM rate_schedule_items WHERE position_title = 'Senior Engineer';
   ```

3. Check project assignment:
   ```sql
   SELECT * FROM project_rate_schedule_assignments WHERE project_id = 123;
   ```

### Rate Changes Not Reflected

**Problem:** Changed a rate but time entries still using old rate

**Explanation:** Time entries use **snapshotted rates** (locked at creation time). This is correct behavior!

**If you need to update:**
- Don't edit historical time entries (breaks audit trail)
- Create an invoice adjustment instead
- Or manually adjust invoice line items

---

## Migration Plan

### Phase 1: Add Function (✅ Done)
- Created `getApplicableRate()` function
- Documented usage
- Added to codebase

### Phase 2: Update Time Entry Creation (⏳ Next)
- Refactor timesheet form to use function
- Add rate validation before save
- Snapshot rate in `time_entry_bill_rates`

### Phase 3: Update Invoice Generation (⏳ Later)
- Replace custom rate logic with function
- Ensure invoices use consistent rates

### Phase 4: Deprecate Old Patterns (⏳ Future)
- Remove direct rate table queries
- Add ESLint rule: "Must use getApplicableRate()"

---

## Testing

```typescript
// Example test
describe('getApplicableRate', () => {
  it('uses project override when available', async () => {
    const rate = await getApplicableRate({
      projectId: 123,
      positionTitle: 'Senior Engineer',
      effectiveDate: '2026-03-27'
    })

    expect(rate.source).toBe('project_override')
    expect(rate.hourlyRate).toBe(150.00)
  })

  it('falls back to default schedule', async () => {
    const rate = await getApplicableRate({
      projectId: 999, // Project with no custom rates
      positionTitle: 'Junior Engineer',
      effectiveDate: '2026-03-27'
    })

    expect(rate.source).toBe('default_schedule')
    expect(rate.hourlyRate).toBeGreaterThan(0)
  })

  it('warns when no rate found', async () => {
    const rate = await getApplicableRate({
      projectId: 123,
      positionTitle: 'Nonexistent Position',
      effectiveDate: '2026-03-27'
    })

    expect(rate.hourlyRate).toBe(0)
    expect(rate.source).toBe('fallback')
    expect(rate.metadata.warnings).toContain('NO RATE FOUND')
  })
})
```

---

## Summary

✅ **One function to rule them all**  
✅ **Clear priority order** (overrides > schedules > default)  
✅ **Full audit trail** (source + timestamp)  
✅ **Prevents $0 rates** (validation helper)  
✅ **Easy to debug** (console logs + warnings)  

**Result:** No more "why is this rate different?" questions! 🎉

