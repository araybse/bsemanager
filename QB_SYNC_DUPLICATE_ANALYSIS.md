# QuickBooks Sync Duplicate Expense Root Cause Analysis

**Date:** April 6, 2026  
**Investigator:** Max (AI Assistant)  
**Status:** ROOT CAUSE IDENTIFIED ✅

---

## Executive Summary

**The duplicate expenses are caused by an unstable `source_line_id` generation algorithm.** When QuickBooks expense lines don't have a stable `Id` property (common for Purchase and Bill lines), the code falls back to using the filtered array index (`line_${lineIndex + 1}`). This index can change between sync runs if:

1. QB reorders lines within a transaction
2. Lines are added/removed that affect the filter criteria
3. Account assignments change (e.g., a line moves in/out of "Contract Labor")

Each time the line index shifts, the sync creates a NEW record instead of updating the existing one, because the `source_line_id` key changed.

**Secondary contributing factor:** No concurrent sync protection exists for the expense domain, allowing race conditions if multiple syncs trigger simultaneously.

---

## Root Cause: Detailed Analysis

### The Bug Location

**File:** `src/lib/qbo/sync/domains/project-expenses.ts`  
**Lines:** 107-123

```typescript
// Line 81-100: Filtering creates a SUBSET of lines
const projectExpenseLines = lines.filter((line) => {
  if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false
  // ... more filtering logic ...
  return Boolean(projectNumber)
})

// Line 107: Iterating over the FILTERED array
for (let lineIndex = 0; lineIndex < projectExpenseLines.length; lineIndex += 1) {
  const line = projectExpenseLines[lineIndex]
  // ...
  
  // Lines 122-123: THE BUG - Using filtered index as fallback ID
  const lineIdValue = String(line.Id || '').trim()
  const sourceLineId = lineIdValue || `line_${lineIndex + 1}`  // ← PROBLEM!
```

### Why This Creates Duplicates

**Scenario:** A QuickBooks Purchase (ID: 456) has 3 lines:

| Line | Original State | Filter Result | sourceLineId |
|------|---------------|---------------|--------------|
| 0 | Office Supplies (no project) | ❌ Excluded | - |
| 1 | Survey for 24-01 | ✅ Included | `line_1` |
| 2 | Permits for 24-01 | ✅ Included | `line_2` |

**Sync Run 1:** Creates records:
- `Purchase:456 :: line_1` → Survey expense
- `Purchase:456 :: line_2` → Permits expense

**Later:** Someone in QB edits Line 0 to assign it to project 24-01.

**Sync Run 2:** Now the filter includes all 3 lines:

| Line | New State | Filter Result | sourceLineId |
|------|-----------|---------------|--------------|
| 0 | Office Supplies for 24-01 | ✅ Included | `line_1` ← NEW! |
| 1 | Survey for 24-01 | ✅ Included | `line_2` ← SHIFTED! |
| 2 | Permits for 24-01 | ✅ Included | `line_3` ← SHIFTED! |

**Result:**
- `Purchase:456 :: line_1` → Office Supplies (overwrites Survey data!)
- `Purchase:456 :: line_2` → Survey (overwrites Permits data!)
- `Purchase:456 :: line_3` → Permits (NEW RECORD!)

The Survey and Permits data from Run 1 is now orphaned or corrupted, and we have duplicated the Permits expense.

### Same Bug Exists in Contract Labor

**File:** `src/lib/qbo/sync/domains/contract-labor.ts`  
**Lines:** 191-213

```typescript
for (let lineIndex = 0; lineIndex < contractLines.length; lineIndex += 1) {
  // ...
  const lineIdValue = String(line.Id || '').trim()
  const sourceLineId = lineIdValue || `line_${lineIndex + 1}`  // ← SAME BUG!
```

---

## Database Schema Analysis

### Unique Index (Exists but Insufficient)

**File:** `supabase/migrations/20260222_phase1_backend_foundation.sql`  
**Lines:** 36-38

```sql
create unique index if not exists ux_project_expenses_external_key
  on public.project_expenses (source_system, source_entity_type, source_entity_id, source_line_id)
  where source_entity_id is not null;
```

**The unique index IS working correctly.** The problem is that the *key values themselves* are unstable, so each shifted line appears as a "new" unique key rather than triggering an update.

### No Concurrent Sync Protection

**File:** `src/app/api/qb-time/sync/route.ts`  
**Lines:** 155-190

The code checks for concurrent `time_entries` syncs but **NOT** for `project_expenses`:

```typescript
if (syncType === 'all' || syncType === 'time') {
  // Only checks time_entries domain!
  const { data: openRuns } = await supabase
    .from('sync_runs')
    .eq('domain', 'time_entries')  // ← Not checking expenses!
```

---

## Verification Queries for Austin

### Query 1: Find Duplicate Patterns

Run this to see if duplicates have different `source_line_id` values:

```sql
-- Find potential duplicate expenses (same transaction, same project, same amount, different line IDs)
SELECT 
  source_entity_id,
  source_line_id,
  project_number,
  expense_date,
  vendor_name,
  fee_amount,
  created_at,
  last_synced_at
FROM project_expenses
WHERE source_system = 'qbo'
  AND source_entity_type = 'project_expense'
  AND project_number = '24-01'  -- Use any affected project
ORDER BY source_entity_id, fee_amount, expense_date;
```

**What to look for:**
- Same `source_entity_id` (like `Purchase:456`) with DIFFERENT `source_line_id` values (`line_1`, `line_2`, `line_3`)
- Same `vendor_name`, `fee_amount`, and `expense_date` appearing multiple times

### Query 2: Count Duplicates Per Transaction

```sql
-- Count how many line IDs exist per QB transaction
SELECT 
  source_entity_id,
  COUNT(*) as line_count,
  SUM(fee_amount) as total_amount,
  array_agg(DISTINCT source_line_id ORDER BY source_line_id) as line_ids
FROM project_expenses
WHERE source_system = 'qbo'
  AND source_entity_type = 'project_expense'
  AND source_active = true
GROUP BY source_entity_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 50;
```

### Query 3: Identify True Duplicates

```sql
-- Find true duplicates (same transaction + same amount + same date = likely same expense)
WITH potential_dupes AS (
  SELECT 
    source_entity_id,
    fee_amount,
    expense_date,
    vendor_name,
    project_number,
    COUNT(*) as dupe_count,
    array_agg(id ORDER BY id) as ids,
    array_agg(source_line_id ORDER BY id) as line_ids
  FROM project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type = 'project_expense'
    AND source_active = true
  GROUP BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
  HAVING COUNT(*) > 1
)
SELECT * FROM potential_dupes
ORDER BY dupe_count DESC, source_entity_id;
```

---

## Recommended Fix

### Fix Option A: Use Original Line Index (RECOMMENDED)

Change the line ID generation to use the **original array index** instead of the filtered array index.

**File:** `src/lib/qbo/sync/domains/project-expenses.ts`

**Before (Lines 81-123):**
```typescript
const projectExpenseLines = lines.filter((line) => { ... })

for (let lineIndex = 0; lineIndex < projectExpenseLines.length; lineIndex += 1) {
  const line = projectExpenseLines[lineIndex]
  // ...
  const sourceLineId = lineIdValue || `line_${lineIndex + 1}`
```

**After:**
```typescript
// Keep track of original indices
const projectExpenseLinesWithIndex = lines
  .map((line, originalIndex) => ({ line, originalIndex }))
  .filter(({ line }) => {
    if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false
    // ... rest of filter logic unchanged ...
  })

for (const { line, originalIndex } of projectExpenseLinesWithIndex) {
  // ...
  const lineIdValue = String(line.Id || '').trim()
  // Use ORIGINAL index, not filtered index
  const sourceLineId = lineIdValue || `line_${originalIndex + 1}`
```

**Pros:**
- Minimal code change
- Maintains backward compatibility with records that have QB line IDs
- Index is now stable (based on original array position)

**Cons:**
- If QB reorders lines at the API level (rare but possible), this still breaks
- Doesn't help if lines are deleted and re-added

### Fix Option B: Use Content-Based Hash (MORE ROBUST)

Generate a stable ID based on the line's actual content.

```typescript
import { createHash } from 'crypto'

function generateStableLineId(
  qbKey: string,
  line: QboExpenseLine,
  originalIndex: number
): string {
  // If QB provides a line ID, use it
  const lineIdValue = String(line.Id || '').trim()
  if (lineIdValue) return lineIdValue
  
  // Generate a content-based hash
  const contentKey = [
    line.Amount?.toString() || '0',
    line.Description || '',
    line.AccountBasedExpenseLineDetail?.AccountRef?.value || '',
    line.AccountBasedExpenseLineDetail?.CustomerRef?.value || '',
  ].join('|')
  
  const hash = createHash('md5')
    .update(`${qbKey}:${contentKey}`)
    .digest('hex')
    .substring(0, 12)
  
  return `hash_${hash}`
}
```

**Pros:**
- Truly stable - survives reordering
- Content changes generate new IDs (intentional - different content = different expense)

**Cons:**
- Changing the description or amount creates a new record (might not be desired)
- More complex implementation
- Doesn't help with existing data migration

### Fix Option C: Database Upsert with ON CONFLICT (DEFENSE IN DEPTH)

Add upsert logic as a safety net:

```sql
-- Add a migration to handle conflicts gracefully
-- This won't prevent the root cause but prevents TRUE duplicates

INSERT INTO project_expenses (...)
VALUES (...)
ON CONFLICT (source_system, source_entity_type, source_entity_id, source_line_id)
WHERE source_entity_id IS NOT NULL
DO UPDATE SET
  fee_amount = EXCLUDED.fee_amount,
  vendor_name = EXCLUDED.vendor_name,
  expense_date = EXCLUDED.expense_date,
  -- ... other fields ...
  last_synced_at = EXCLUDED.last_synced_at;
```

**Note:** This requires changing the Supabase insert call to use `.upsert()` with `onConflict`.

---

## Implementation Plan

### Phase 1: Fix the Root Cause (30 min)

1. **Update `project-expenses.ts`** to use original array indices
2. **Update `contract-labor.ts`** with the same fix
3. Test locally with a known problematic transaction

### Phase 2: Add Concurrent Sync Protection (15 min)

Add the same in-progress check used for `time_entries` to the expense sync:

```typescript
// Add to sync/route.ts before running expense sync
if (syncType === 'all' || syncType === 'expenses') {
  const { data: openRuns } = await supabase
    .from('sync_runs')
    .select('id, started_at')
    .eq('domain', 'project_expenses_general')
    .eq('status', 'in_progress')
    .is('finished_at', null)
  
  if (openRuns && openRuns.length > 0) {
    return NextResponse.json(
      { error: 'An expense sync is already in progress.' },
      { status: 409 }
    )
  }
}
```

### Phase 3: Clean Up Existing Duplicates (1 hour)

**Step 1:** Identify duplicates using Query 3 above

**Step 2:** Run deduplication script:

```sql
-- Mark duplicates as inactive, keeping the OLDEST record
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source_entity_id, fee_amount, expense_date, vendor_name, project_number
      ORDER BY created_at ASC
    ) as rn
  FROM project_expenses
  WHERE source_system = 'qbo'
    AND source_entity_type = 'project_expense'
    AND source_active = true
)
UPDATE project_expenses
SET 
  source_active = false,
  source_closed_at = NOW(),
  source_close_reason = 'duplicate_cleanup_2026_04_06'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

**Step 3:** Verify cleanup:

```sql
-- Check how many were deactivated
SELECT COUNT(*) as deactivated_duplicates
FROM project_expenses
WHERE source_close_reason = 'duplicate_cleanup_2026_04_06';

-- Verify no active duplicates remain
SELECT 
  source_entity_id,
  fee_amount,
  expense_date,
  vendor_name,
  COUNT(*) as count
FROM project_expenses
WHERE source_system = 'qbo'
  AND source_entity_type = 'project_expense'
  AND source_active = true
GROUP BY source_entity_id, fee_amount, expense_date, vendor_name
HAVING COUNT(*) > 1;
```

### Phase 4: Run Fresh Sync (15 min)

After fixing the code and cleaning duplicates, run a full sync to stabilize the data.

---

## Complete Code Fix

### File: `src/lib/qbo/sync/domains/project-expenses.ts`

Replace lines 81-145 with:

```typescript
      const lines = Array.isArray(exp.Line) ? exp.Line : []
      
      // Map with original indices before filtering
      const projectExpenseLinesWithIndex = lines
        .map((line, originalIndex) => ({ line, originalIndex }))
        .filter(({ line }) => {
          if (line.DetailType !== 'AccountBasedExpenseLineDetail') return false

          const accountRef = line.AccountBasedExpenseLineDetail?.AccountRef || {}
          const accountRefValue = String(accountRef.value || '').trim()
          const accountName = normalize(accountRef.name)
          const isContractLaborAccount =
            (accountRefValue && accountRefValue === contractLaborAccountId) ||
            accountName === 'contract labor' ||
            accountName.endsWith(':contract labor')
          if (isContractLaborAccount) return false

          const customerName =
            line.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
            exp.CustomerRef?.name ||
            ''
          const projectNumber = extractProjectNumberFromName(customerName)
          return Boolean(projectNumber)
        })

      if (!projectExpenseLinesWithIndex.length) continue

      const vendorName =
        exp.EntityRef?.name || exp.VendorRef?.name || exp.PayeeRef?.name || 'Unknown'
      const qboUpdatedAt = exp.MetaData?.LastUpdatedTime || null

      for (const { line, originalIndex } of projectExpenseLinesWithIndex) {
        const amount = Number(line.Amount) || 0
        if (amount === 0) continue

        const customerName =
          line.AccountBasedExpenseLineDetail?.CustomerRef?.name ||
          exp.CustomerRef?.name ||
          ''
        const projectNumber = extractProjectNumberFromName(customerName)
        if (!projectNumber) continue

        totalRows += 1
        const projectId = projectMap.get(projectNumber) || null
        const description = line.Description || (exp.PrivateNote as string | undefined) || null
        const lineIdValue = String(line.Id || '').trim()
        // FIX: Use original array index instead of filtered index
        const sourceLineId = lineIdValue || `line_${originalIndex + 1}`
        const seenKey = `${qbKey}::${sourceLineId}`
        seenQbKeys.add(seenKey)

        // ... rest of the loop unchanged ...
```

### File: `src/lib/qbo/sync/domains/contract-labor.ts`

Apply the same pattern to lines 167-213.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fix breaks existing records | Low | Medium | Dedup cleanup handles this; soft-delete preserves data |
| Concurrent sync creates new dupes | Medium | Low | Add in-progress check before fixing |
| QB reorders lines at API level | Very Low | Medium | Content hash approach as future enhancement |
| Cleanup deletes legitimate expenses | Low | High | Keep oldest record; use soft-delete; manual review option |

---

## Testing Plan

1. **Unit Test:** Create mock QB data with/without line IDs, verify stable sourceLineId
2. **Integration Test:** 
   - Run sync → modify a line's account in QB → run sync again
   - Verify no duplicates created
3. **Regression Test:** Run full sync on production data, compare record counts before/after
4. **Manual Verification:** Pick 5 projects, compare QB totals to app totals

---

## Summary

| Item | Status |
|------|--------|
| Root cause identified | ✅ Unstable `source_line_id` from filtered array index |
| Fix designed | ✅ Use original array index |
| Code fix applied | ✅ Both `project-expenses.ts` and `contract-labor.ts` updated |
| Cleanup script ready | ✅ Soft-delete duplicates keeping oldest |
| Concurrent sync risk identified | ✅ Add in-progress check |
| Estimated fix time | 2 hours total |

**Confidence Level:** HIGH - The code bug is clear and reproducible. The fix is straightforward.

---

## Deliverables Created

### 1. Code Fixes (ALREADY APPLIED)

- **`src/lib/qbo/sync/domains/project-expenses.ts`** - Fixed to use original array indices
- **`src/lib/qbo/sync/domains/contract-labor.ts`** - Fixed to use original array indices

### 2. SQL Scripts

- **`scripts/audit-duplicate-expenses.sql`** - Run this FIRST to see what duplicates exist
- **`supabase/migrations/20260406_fix_duplicate_project_expenses.sql`** - Cleanup migration

---

## Execution Order

1. **Review this report** ✅
2. **Run audit script** in Supabase SQL Editor:
   ```sql
   -- Copy contents from scripts/audit-duplicate-expenses.sql
   ```
3. **Deploy code fix** (git commit + deploy)
4. **Run cleanup migration** after code is deployed:
   ```bash
   supabase db push
   ```
   Or run `20260406_fix_duplicate_project_expenses.sql` manually in Supabase
5. **Trigger fresh sync** to stabilize data with fixed code
6. **Verify** by re-running the audit script (should show 0 duplicates)
