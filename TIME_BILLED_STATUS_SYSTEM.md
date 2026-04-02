# Time Entry Billed Status System

## Overview
Automatic system that marks time entries as "Billed" when they appear on an invoice. This provides accurate billing status on the Time Entries page.

## How It Works

### 1. During Invoice Sync (Automatic)
When QuickBooks invoices are synced:
1. Invoice is inserted/updated in `invoices` table
2. System finds all unbilled time entries for that project + billing period
3. Marks matching time entries as `is_billed = true`

**File**: `src/lib/qbo/sync/domains/invoices.ts` (lines ~120-130)

### 2. Billing Status Logic
**File**: `src/lib/billing/update-time-billed-status.ts`

```typescript
updateTimeBilledStatus({
  projectId: 123,
  billingPeriod: '2026-02-01', // First day of month
  invoiceId: 456
})
```

**Matching criteria:**
- Same `project_id`
- Same `billing_period` (first day of the billing month)
- Current status: `is_billed = false`

## Database Schema

### time_entries table
- `is_billed` (boolean): Whether this time has been invoiced
- `billing_period` (date): First day of the month this time belongs to
- Both fields are set during QB sync

### invoices table
- `billing_period` (date): First day of the month this invoice covers
- Used to match time entries to invoices

## Backfill for Historical Data

### One-Time Setup
Run this script ONCE after deploying to mark existing time entries as billed:

```bash
cd bsemanager
node scripts/backfill-time-billed-status.mjs
```

**What it does:**
1. Finds all existing invoices
2. For each invoice, finds unbilled time entries matching project + billing period
3. Marks them as `is_billed = true`

**Safe to run multiple times** - only updates unbilled entries (idempotent)

## Time Entries Page Display

**File**: `src/app/(authenticated)/time-entries/page.tsx`

Shows status badge for each entry:
- 🟢 **Billed** - Time has been invoiced to client
- ⚪ **Unbilled** - Time not yet invoiced

## Testing

### Verify the system works:
1. **Check current status**: Go to Time Entries page, filter by a project with invoices
2. **Trigger a sync**: Settings → QuickBooks → Sync Now
3. **Verify update**: Time entries with matching billing period should show "Billed"

### Manual test in console:
```javascript
import { updateTimeBilledStatus } from '@/lib/billing/update-time-billed-status'

const result = await updateTimeBilledStatus({
  projectId: 65,           // Project ID
  billingPeriod: '2026-02-01',  // First day of month
  invoiceId: 912           // Invoice ID
})

console.log(result)
// { success: true, entriesUpdated: 17 }
```

## Implementation Summary

**Files created:**
1. `src/lib/billing/update-time-billed-status.ts` - Core logic
2. `scripts/backfill-time-billed-status.mjs` - One-time historical backfill

**Files modified:**
1. `src/lib/qbo/sync/domains/invoices.ts` - Added auto-update on invoice sync

**No database changes needed** - uses existing `is_billed` and `billing_period` fields

## Deployment Steps

1. **Deploy code** - Push to GitHub, deploy to Vercel
2. **Run backfill** - Execute backfill script once to mark historical entries
3. **Verify** - Check Time Entries page for accurate statuses
4. **Monitor** - Future invoices will auto-update time entry status

## Notes

- Status updates happen during QB sync - no manual intervention needed
- Only unbilled entries are updated (won't overwrite existing billed status)
- If an invoice is deleted, time entries remain billed (conservative approach)
- Billing period is always the first day of the month
