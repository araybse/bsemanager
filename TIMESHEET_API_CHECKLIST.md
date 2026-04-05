# Timesheet API Implementation Checklist

**Task:** Build 3 core Timesheet API endpoints  
**Developer:** Sam (API Developer)  
**Date:** April 5, 2026  

---

## ✅ Completed Tasks

### API Endpoints

- [x] **GET /api/timesheets/[week]/route.ts**
  - [x] Fetch all entries for specific week (week_ending_date)
  - [x] Return grid format: project/phase rows × day columns
  - [x] Include totals per day and per row
  - [x] Filter by employee_id (users see only theirs, admin sees all)
  - [x] Validate week parameter is Saturday
  - [x] Calculate week status (empty/draft/submitted/approved)

- [x] **POST /api/timesheets/entry/route.ts**
  - [x] Create or update single time entry
  - [x] Validate: user can only edit DRAFT/SUBMITTED entries
  - [x] Admin can edit any entry (unless approved)
  - [x] Auto-calculate week_ending_date from entry_date
  - [x] Require description (notes) field
  - [x] Return updated entry
  
- [x] **DELETE /api/timesheets/entry/route.ts**
  - [x] Delete draft entries only
  - [x] Verify ownership (or admin)
  - [x] Return success status

- [x] **POST /api/timesheets/copy-week/route.ts**
  - [x] Copy all entries from previous week
  - [x] Extract unique project/phase combinations
  - [x] Set status='draft', update dates to current week
  - [x] Create entries on Monday of target week
  - [x] Skip combinations that already exist
  - [x] Return new entries count

### Type Definitions

- [x] Update `src/lib/types/database.ts`
  - [x] Add `status` field to time_entries
  - [x] Add `week_ending_date` field
  - [x] Add `submitted_at` field
  - [x] Add `approved_at` field
  - [x] Add `approved_by` field
  - [x] Update Row, Insert, and Update interfaces

### Auth Helpers

- [x] Create `requireApiAuth()` function
  - [x] Basic authentication check
  - [x] Returns user object with id, email, role
  - [x] Used by all timesheet endpoints

### Validation Rules

- [x] Users can only edit status='draft' or 'submitted' entries
- [x] Description required for entries with hours > 0
- [x] Users can only delete draft entries
- [x] Users can only access their own data (unless admin)
- [x] Admin can bypass most restrictions (but not edit approved entries)

---

## 📋 Verification

### Code Quality

- [x] TypeScript types properly defined
- [x] Error handling implemented
- [x] Input validation present
- [x] Proper HTTP status codes used
- [x] Consistent code style

### Security

- [x] All endpoints require authentication
- [x] Row-level security checks (employee_id validation)
- [x] Status-based access control
- [x] Admin role verification

### Database

- [x] Migrations already created (by Oliver)
  - `20260405_timesheet_status_fields.sql`
  - `20260405_timesheet_rls_policies.sql`
- [ ] **Migrations need to be applied to database** (pending Austin's action)

---

## 🚧 Out of Scope (Not Implemented)

The following endpoints were mentioned in the full plan but are NOT part of this task (B.1-B.3 only):

- [ ] POST /api/timesheets/submit/route.ts (Week submission)
- [ ] POST /api/timesheets/approve/route.ts (Admin approval)
- [ ] GET /api/timesheets/pending-approvals/route.ts (Admin view)

**Note:** These files exist in the codebase but have TypeScript errors and were created by another developer. Not Sam's responsibility.

---

## 📦 Deliverables

1. ✅ **3 API Endpoint Files**
   - `src/app/api/timesheets/[week]/route.ts`
   - `src/app/api/timesheets/entry/route.ts`
   - `src/app/api/timesheets/copy-week/route.ts`

2. ✅ **Updated Type Definitions**
   - `src/lib/types/database.ts`

3. ✅ **Updated Auth Helper**
   - `src/lib/auth/api-authorization.ts`

4. ✅ **Documentation**
   - `TIMESHEET_API_IMPLEMENTATION_SUMMARY.md`
   - `TIMESHEET_API_CHECKLIST.md` (this file)
   - `test-timesheet-api.sh` (test script)

---

## 🧪 Testing Status

### Manual Testing

- [ ] **Needs database migrations applied first**
- [ ] GET endpoint with valid week
- [ ] GET endpoint with invalid week (not Saturday)
- [ ] POST entry (create new)
- [ ] POST entry (update existing)
- [ ] POST entry with missing notes (should fail)
- [ ] POST entry to approved entry (should fail)
- [ ] DELETE draft entry
- [ ] DELETE non-draft entry (should fail)
- [ ] POST copy-week with previous week data
- [ ] POST copy-week with no previous data

### Automated Testing

- [ ] Unit tests not yet written
- [ ] Integration tests not yet written
- [ ] E2E tests not yet written

**Note:** Testing requires database migrations to be applied first.

---

## 📝 Next Steps

### For Database Admin (Austin)

1. **Apply migrations to production database:**
   ```bash
   cd /Users/austinray/.openclaw/workspace/bsemanager
   supabase db push
   ```
   
   Or apply manually in Supabase Studio:
   - `supabase/migrations/20260405_timesheet_status_fields.sql`
   - `supabase/migrations/20260405_timesheet_rls_policies.sql`

2. **Verify migration success:**
   - Check `time_entries` table has new columns
   - Check existing entries have `status='approved'`
   - Check triggers are created
   - Check indexes are created

### For UI Developer (Sophia)

1. Read implementation plan sections C.1-C.8
2. Build UI components that consume these APIs
3. Test with real API calls after migrations are applied
4. Use example curl commands from `TIMESHEET_API_IMPLEMENTATION_SUMMARY.md`

### For Testing

1. Apply database migrations
2. Run manual tests using `test-timesheet-api.sh`
3. Create unit tests for helper functions
4. Create integration tests for endpoints
5. Create E2E tests with Playwright

---

## ⏱️ Time Tracking

- **Estimated:** 4-5 hours
- **Actual:** ~3 hours
- **Status:** Ahead of schedule ✅

---

## 📊 Metrics

- **Lines of Code:** ~350 (API endpoints only)
- **Files Created:** 3 endpoints + 1 test script
- **Files Modified:** 2 (types + auth)
- **Endpoints:** 4 (GET + POST + DELETE + POST)
- **TypeScript Errors:** 0 (in my code)

---

## ✨ Summary

All 3 core timesheet API endpoints have been successfully implemented with:
- Full validation and error handling
- Proper authentication and authorization
- TypeScript type safety
- Security best practices
- Clean, maintainable code

**Ready for:** Database migration → Testing → UI integration

---

**Sam (API Developer)**  
*April 5, 2026*
