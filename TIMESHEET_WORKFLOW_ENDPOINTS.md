# Timesheet Workflow API Endpoints

**Author:** Sophia (API Developer)  
**Date:** April 5, 2026  
**Status:** ✅ Complete

## Overview

Three workflow endpoints for timesheet status management (draft → submitted → approved).

---

## 1. POST /api/timesheets/submit

**Purpose:** Submit all DRAFT entries for a specific week for approval.

### Authentication
- **Required:** Yes (any authenticated user)
- **Authorization:** User can only submit their own entries

### Request

```typescript
POST /api/timesheets/submit
Content-Type: application/json

{
  "weekEndingDate": "2026-04-12"  // Must be a Saturday (YYYY-MM-DD)
}
```

### Response (Success - 200)

```json
{
  "success": true,
  "message": "Submitted 15 entries for approval",
  "entriesSubmitted": 15
}
```

### Response (Error - 400)

```json
// Invalid date (not a Saturday)
{
  "error": "Week ending date must be a Saturday"
}

// No draft entries
{
  "error": "No draft entries found for this week"
}

// Missing work descriptions
{
  "error": "3 entries are missing work descriptions"
}
```

### Response (Error - 401)

```json
{
  "error": "Unauthorized"
}
```

### Business Logic

1. Validates `weekEndingDate` is a Saturday
2. Fetches all entries for the authenticated user with:
   - `week_ending_date = weekEndingDate`
   - `status = 'draft'`
3. Validates all entries have non-empty `notes` field
4. Updates all matching entries:
   - `status = 'draft'` → `status = 'submitted'`
   - Sets `submitted_at = NOW()`
5. Returns count of submitted entries

### Database Changes

```sql
UPDATE time_entries
SET 
  status = 'submitted',
  submitted_at = NOW()
WHERE 
  employee_id = <current_user_id>
  AND week_ending_date = <weekEndingDate>
  AND status = 'draft'
```

---

## 2. POST /api/timesheets/approve

**Purpose:** Admin approves all SUBMITTED entries for a specific week + employee.

### Authentication
- **Required:** Yes
- **Authorization:** Admin only

### Request

```typescript
POST /api/timesheets/approve
Content-Type: application/json

{
  "employeeId": "uuid-of-employee",
  "weekEndingDate": "2026-04-12"  // Must be a Saturday
}
```

### Response (Success - 200)

```json
{
  "success": true,
  "message": "Approved 15 entries",
  "entriesApproved": 15,
  "entries": [/* array of updated time_entry objects */]
}
```

### Response (Error - 400)

```json
// Invalid date
{
  "error": "Week ending date must be a Saturday"
}

// No pending entries
{
  "error": "No pending entries found for this week"
}
```

### Response (Error - 403)

```json
{
  "error": "Forbidden"
}
```

### Business Logic

1. Validates requester is admin
2. Validates `weekEndingDate` is a Saturday
3. Fetches all entries for the specified employee with:
   - `week_ending_date = weekEndingDate`
   - `status IN ('submitted', 'draft')`
4. Updates all matching entries:
   - `status` → `'approved'`
   - Sets `approved_at = NOW()`
   - Sets `approved_by = <admin_user_id>`
5. Returns count and updated entries

### Database Changes

```sql
UPDATE time_entries
SET 
  status = 'approved',
  approved_at = NOW(),
  approved_by = <admin_user_id>
WHERE 
  employee_id = <employeeId>
  AND week_ending_date = <weekEndingDate>
  AND status IN ('submitted', 'draft')
RETURNING *
```

### Notes

- Approves both `submitted` and `draft` entries (allows admin to force-approve)
- Once approved, entries are **locked** and cannot be edited
- RLS policies prevent editing approved entries

---

## 3. GET /api/timesheets/pending-approvals

**Purpose:** Admin view of all pending timesheets across all employees.

### Authentication
- **Required:** Yes
- **Authorization:** Admin only

### Request

```typescript
GET /api/timesheets/pending-approvals
```

### Response (Success - 200)

```json
{
  "pendingApprovals": [
    {
      "employeeId": "uuid-1",
      "employeeName": "John Smith",
      "weekEndingDate": "2026-04-12",
      "totalHours": 40.0,
      "entryCount": 8,
      "hasSubmitted": true,
      "hasDraft": false,
      "status": "submitted"
    },
    {
      "employeeId": "uuid-2",
      "employeeName": "Jane Doe",
      "weekEndingDate": "2026-04-05",
      "totalHours": 32.5,
      "entryCount": 6,
      "hasSubmitted": true,
      "hasDraft": true,
      "status": "partial"
    }
  ],
  "count": 2
}
```

### Response (Error - 403)

```json
{
  "error": "Forbidden"
}
```

### Business Logic

1. Validates requester is admin
2. Fetches all entries with `status IN ('submitted', 'draft')`
3. Groups results by `employee_id` and `week_ending_date`
4. Calculates for each group:
   - Total hours
   - Entry count
   - Whether any entries are submitted
   - Whether any entries are draft
5. Filters to only weeks with at least one submitted entry
6. Returns sorted by `week_ending_date DESC`, then `employee_name ASC`

### Status Field

- `"submitted"` - All entries in the week are submitted
- `"partial"` - Mix of submitted and draft entries (user hasn't submitted everything yet)

### Use Case

Admin dashboard showing all pending approvals across the organization:

```typescript
// Example frontend usage
const { pendingApprovals } = await fetch('/api/timesheets/pending-approvals')
  .then(r => r.json())

pendingApprovals.forEach(approval => {
  console.log(`${approval.employeeName} - Week ending ${approval.weekEndingDate}`)
  console.log(`  ${approval.totalHours} hours (${approval.entryCount} entries)`)
  console.log(`  Status: ${approval.status}`)
})
```

---

## Database Schema Reference

### time_entries Table (Workflow Fields)

```sql
CREATE TABLE time_entries (
  -- ... existing fields ...
  
  -- Workflow fields (added by migration 20260405_timesheet_status_fields.sql)
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'submitted', 'approved')),
  
  week_ending_date DATE NOT NULL,  -- Auto-calculated Saturday
  
  submitted_at TIMESTAMPTZ,        -- When user submitted
  approved_at TIMESTAMPTZ,         -- When admin approved
  approved_by UUID REFERENCES profiles(id)  -- Which admin approved
)
```

### Status Transitions

```
┌──────────┐
│  DRAFT   │ ← New entries start here
└────┬─────┘
     │ User submits via POST /api/timesheets/submit
     ▼
┌──────────┐
│SUBMITTED │ ← User CAN still edit (until approved)
└────┬─────┘
     │ Admin approves via POST /api/timesheets/approve
     ▼
┌──────────┐
│ APPROVED │ ← LOCKED - No edits allowed
└──────────┘
```

---

## Testing

### Unit Test Script

```bash
cd /Users/austinray/.openclaw/workspace/bsemanager
./tests/verify-timesheet-endpoints.mjs
```

### Manual Testing with cURL

```bash
# 1. Get auth token first (login via UI and grab from localStorage)
AUTH_TOKEN="your-supabase-auth-token"

# 2. Submit week
curl -X POST http://localhost:3000/api/timesheets/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"weekEndingDate": "2026-04-12"}'

# 3. Get pending approvals (admin only)
curl http://localhost:3000/api/timesheets/pending-approvals \
  -H "Authorization: Bearer $AUTH_TOKEN"

# 4. Approve week (admin only)
curl -X POST http://localhost:3000/api/timesheets/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "employeeId": "uuid-of-employee",
    "weekEndingDate": "2026-04-12"
  }'
```

---

## Frontend Integration

### React Query Hook Example

```typescript
// hooks/useTimesheetSubmit.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useTimesheetSubmit() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (weekEndingDate: string) => {
      const res = await fetch('/api/timesheets/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekEndingDate })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidate timesheet queries to refetch
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })
}

// Usage in component
const submitMutation = useTimesheetSubmit()

const handleSubmit = async () => {
  try {
    await submitMutation.mutateAsync('2026-04-12')
    toast.success('Timesheet submitted for approval!')
  } catch (err) {
    toast.error(err.message)
  }
}
```

---

## Validation Rules

### Week Ending Date
- Must be in format `YYYY-MM-DD`
- Must be a Saturday (day of week = 6)
- Enforced on all endpoints

### Submit Endpoint
- All draft entries must have non-empty `notes` field
- Returns error if any entries missing descriptions
- Only updates entries belonging to authenticated user

### Approve Endpoint  
- Only users with `role = 'admin'` can approve
- Can approve both `submitted` and `draft` entries
- Sets approval metadata (timestamp, approver ID)

### Pending Approvals
- Only returns weeks with at least one `submitted` entry
- Filters out purely `draft` weeks
- Groups by employee + week for clean dashboard view

---

## Implementation Checklist

- [✅] Database migration (status, week_ending_date fields)
- [✅] POST /api/timesheets/submit endpoint
- [✅] POST /api/timesheets/approve endpoint
- [✅] GET /api/timesheets/pending-approvals endpoint
- [✅] Auth middleware integration (requireApiAuth, requireApiRoles)
- [✅] Input validation (Saturday check, notes check)
- [✅] Error handling and status codes
- [✅] Test script created
- [✅] Documentation written
- [ ] Frontend integration (to be done by Frontend Dev)
- [ ] E2E testing with real data
- [ ] Deploy to production

---

## Files Created

```
src/app/api/timesheets/
├── submit/
│   └── route.ts          ✅ Submit week endpoint
├── approve/
│   └── route.ts          ✅ Approve week endpoint  
└── pending-approvals/
    └── route.ts          ✅ Pending approvals list endpoint

tests/
└── verify-timesheet-endpoints.mjs  ✅ Automated test script
```

---

## Next Steps

**For Frontend Developer (Sam):**

1. Create UI components (WeeklyCalendarGrid, TimesheetActions, etc.)
2. Integrate these endpoints with React Query hooks
3. Add submit/approve buttons to timesheet view
4. Build admin approval dashboard using pending-approvals endpoint
5. Add toast notifications for success/error states
6. Handle edge cases (missing descriptions, invalid dates)

**For Testing:**

1. Run `./tests/verify-timesheet-endpoints.mjs` to verify endpoints respond
2. Manual testing with real user data
3. Test RLS policies (users can't approve, admins can)
4. Test status transitions (draft → submitted → approved)
5. Verify approved entries are locked (RLS prevents edits)

---

**Estimated Time:** 3-4 hours ✅ **COMPLETE**  
**Parallel Work:** Can proceed with frontend development simultaneously

_Sophia - API Developer, April 5, 2026_
