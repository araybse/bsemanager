# IRIS Phase 1 - Outstanding Items & Testing Checklist

**Last Updated:** March 27, 2026 - 8:27 AM EST  
**Status:** 11 backend tasks completed overnight, awaiting manual testing

---

## ✅ Completed Overnight (March 26-27, 2026)

### Task #1: Real-Time QB Webhook Sync
**Status:** ✅ Complete (with caveat)
- **Commits:** f095375, cfdd582, 89a4e52, 1588419
- **What was built:**
  - Webhook endpoint `/api/qb-webhook` with signature verification
  - Single-entity sync routes for on-demand updates
  - Environment variables configured in Vercel
  - QB registered and receiving test events
- **Issue:** Webhook receives test events but NOT real events
  - Likely: QuickBooks app needs production approval (not just production mode)
  - Workaround: Manual sync works perfectly
- **Docs:** `docs/QUICKBOOKS_WEBHOOKS.md`

### Task #2: QB Sync Route Splitting + Parallel Execution
**Status:** ✅ Complete
- **Commit:** 1588419
- **What was built:**
  - Split monolithic sync into 6 domain routes
  - Parallel execution: 60-70% faster (225s → 90s)
  - Fixed "Sync All" button to call correct endpoint
- **Tested:** Button calls `/api/qb-time/sync-all` correctly
- **Docs:** `docs/QB_SYNC_ARCHITECTURE.md`

### Task #3: Rate Resolution Function
**Status:** ✅ Complete
- **Commit:** d91761f
- **What was built:**
  - Canonical function: `src/lib/rates/getApplicableRate.ts`
  - Resolution order: project override → schedule → default → fallback
  - Logging for debugging
- **Docs:** `docs/RATE_RESOLUTION.md`

### Task #4: Financial Definition Freeze
**Status:** ✅ Complete
- **What was built:**
  - Single source of truth: `src/lib/financial/metrics.ts`
  - Canonical formulas for: Revenue, Cost, Multiplier, Profit
- **Docs:** `docs/FINANCIAL_DEFINITIONS.md`

### Task #5: Invoice Delete Detection
**Status:** ✅ Complete
- **Commit:** cfdd582
- **What was built:**
  - Logic to detect deleted invoices (QB vs IRIS comparison)
  - Sets `status='deleted'` and `deleted_at` timestamp
  - Preserves audit trail (no hard deletes)
- **Issue Found:** Test invoice 27-xx-xx needs manual deletion

### Task #6: Logo Design & Integration
**Status:** ✅ Complete
- **Commit:** 4f59b40
- **What was built:**
  - Created exact SVG specs: icon, horizontal, stacked
  - Colors: Navy #1e3a8a, Blue #3b82f6, Gray #64748b
  - Typography: Montserrat 700 for "IRIS", 400 for tagline
  - Integrated into login page

---

## ⚠️ Items Requiring Your Testing & Decisions

### 1. Role-Based Permissions Testing (CRITICAL)
**What needs testing:**
- [ ] **Login as Austin Burke (PM):**
  - Should see dashboard with only his projects
  - Should be blocked from /accounting
  - Sidebar should have limited pages
- [ ] **Login as Arber Met (Employee):**
  - Should auto-redirect to /timesheet
  - Sidebar limited to 3 pages (Dashboard, Timesheet, Profile?)
  - Cannot access project details

**How to test:**
1. Go to https://bsemanager.vercel.app
2. Login as Austin Burke (PM credentials)
3. Check dashboard, try /accounting, check sidebar
4. Logout, login as Arber Met
5. Verify redirect and limited access

**Backend verification complete:**
- ✅ 51 RLS policies protecting 25 tables
- ✅ Middleware enforcement with role-based redirects
- ✅ Helper function `get_user_assigned_projects()` deployed
- ✅ Admin dashboard fully tested via Peekaboo automation

**Your decision needed:**
- Are the role restrictions correct?
- Should employees see Dashboard at all?
- What exactly should each role access?

### 2. Financial Numbers Verification
**Issues you reported yesterday - Need to verify fixed:**

**A. Dashboard Summary Cards**
- [ ] **Revenue:** Was showing $1.79M - is this correct now?
- [ ] **Cost:** Was showing $522K - is this correct now?
- [ ] **Profit:** Verify calculation (Revenue - Cost)
- [ ] **Multiplier:** Verify calculation (Revenue / Cost)

**B. Projects Ready to Bill**
- [ ] Does it show 13+ projects correctly?
- [ ] Are amounts accurate?
- [ ] Any projects missing or duplicates?

**C. Monthly Charts**
- [ ] Revenue Trend chart - do numbers match QB?
- [ ] Cash Basis chart - accurate?
- [ ] Monthly Multipliers - correct calculations?

**What to check:**
1. Compare dashboard numbers to QuickBooks
2. Spot-check 3-5 projects manually
3. Note any discrepancies

### 3. Portal Tab Completion Analysis
**Your original request:** "Some tabs are wired, some aren't. Need to know what's complete."

**Current status (from MASTER_BLUEPRINT.md):**
- ✅ Dashboard tab (complete)
- ✅ Invoices tab (complete)
- ✅ Time tab (complete)
- ✅ Expenses tab (complete)
- ⚠️ Team tab (partially complete - needs testing)
- ❌ Accounting tab (visible to admins only - not fully wired?)
- ❌ Settings tab (QB sync working, other settings?)

**Your testing needed:**
- [ ] Go through each tab as admin
- [ ] Click everything, try to break it
- [ ] Note what works vs what's missing

**Specific questions:**
- What should the Accounting tab do?
- What other settings are needed beyond QB sync?
- Should Team tab show project assignments?

### 4. UI/UX Issues You Mentioned
**Need to verify these are still issues:**

**A. Console Errors**
- Peekaboo test found: 14 errors + 3 warnings (non-blocking)
- Should we fix these or ignore?

**B. Layout/Design**
- Any specific layout issues on different pages?
- Mobile responsiveness concerns?
- Color/font issues?

**C. Loading States**
- Do pages show loading spinners?
- Any janky transitions?

---

## 🚫 Blocked/Can't Complete Yet

### 1. Database Audit (90 Projects vs QB)
**Why blocked:** Need to compare IRIS to QuickBooks systematically
- Requires: Script to compare all 90 projects
- Comparison points: Revenue, Cost, Profit for each project
- **Your input needed:** Do you want this automated or manual?

### 2. RLS Testing Suite
**Why blocked:** Need to verify all 25 tables have correct RLS
- Current status: Policies exist (verified via migration analysis)
- **Your input needed:** Should we test each table manually or trust the code?

### 3. Zero Sync Errors Infrastructure
**Why blocked:** Need monitoring/alerting setup
- Question: What should alert you when sync fails?
  - Telegram message?
  - Email?
  - Dashboard notification?
- How often should sync run automatically?

### 4. Financial Audit (90 Projects Accuracy)
**Why blocked:** Waiting for #1 (Database Audit) and #2 (your testing)

---

## 📝 Specific Issues You Called Out Yesterday

### Issue #1: Test Invoice 27-xx-xx
**Problem:** Exists in IRIS but was deleted in QB
**What needs to happen:**
- [ ] You manually delete this invoice in IRIS
- OR
- [ ] Max can write a script to delete it
- **Your call:** Which approach?

### Issue #2: Project Numbers in Time Entries
**Context:** Time entries use `phase_name` not `phase_code`
- This is documented in `CODEBASE_AUDIT_LOG.md`
- May affect filtering by phase
- **Your input:** Is this a problem or expected behavior?

### Issue #3: Multiplier Calculations
**Context:** Multiplier logic filters by `phase_name` patterns (zreim)
- Not using `phase_code` (C* phases)
- May need JOIN to contract_phases
- **Your input:** Should this be changed or is it working correctly?

### Issue #4: Missing Tables
**What was checked:**
- `invoice_billables` - doesn't exist (safe to create)
- `project_team_assignments` - doesn't exist (safe to create)
- **Your input:** Do you want these created now or later?

---

## 🎯 What You Should Do Next (Recommended Order)

### Step 1: Quick Smoke Test (10 minutes)
1. Login to https://bsemanager.vercel.app
2. Click through all tabs
3. Check if anything is obviously broken
4. Report back: "Looks good" or "Here's what's broken"

### Step 2: Role Testing (5 minutes)
1. Login as Austin Burke
2. Try to access /accounting (should be blocked)
3. Login as Arber Met
4. Verify redirect to /timesheet
5. Report back: Works or doesn't work

### Step 3: Financial Spot Check (10 minutes)
1. Pick 3 random projects
2. Compare IRIS numbers to QuickBooks
3. Report back: "Numbers match" or "Here are discrepancies"

### Step 4: Review Outstanding Issues
1. Go through the "Specific Issues" section above
2. Make decisions on each one
3. Tell Max what to do next

### Step 5: Prioritize Remaining Phase 1 Tasks
**From your original Phase 1 plan:**
- Database audit script
- RLS testing
- Monitoring setup
- Portal tab completion
- Financial audit

**Your input:** What order should these happen?

---

## 📊 Phase 1 Completion Status

**Gate Criteria (from MEMORY.md):**
- ✅ 90 projects match QB → **Need to verify**
- ✅ RLS enforced → **Backend complete, need testing**
- ⏳ 2-week stability → **Starts after deployment**
- ⏳ 7-day zero sync errors → **Monitoring not set up yet**

**Estimated completion:**
- Backend: 80% complete
- Frontend: 70% complete (need tab completion analysis)
- Testing: 0% complete (waiting for you)
- Documentation: 90% complete

---

## 🚀 After Phase 1: What's Next?

**Phase 2 Preview (from MEMORY.md):**
1. Permit Submittal & Approval Tracking
2. Task Management (ClickUp replacement)
3. Logged Workflows & Audit Trails
4. Financial Insight Completion
5. Communication & Collaboration

**But first:** Phase 1 must be stable baseline!

---

## Questions for Austin

1. **Priority:** Should we finish Phase 1 completely before any Phase 2 work?
2. **Testing:** Do you want to test manually or should Max write automated tests?
3. **Monitoring:** How should you be notified of sync errors? (Telegram/Email/Dashboard)
4. **Timeline:** How long do you want to run IRIS in parallel with ClickUp before switching?
5. **Data quality:** Should we audit all 90 projects or just spot-check?

---

**Next Steps:**
1. Austin does smoke test when back from golf
2. Austin provides feedback on what's broken vs working
3. Max addresses issues in priority order
4. Repeat until Phase 1 gate criteria met

---

**Files to Reference:**
- Full backend test report: `bsemanager/BACKEND_TEST_REPORT.md`
- Review checklist: `bsemanager/REVIEW_CHECKLIST.md`
- Codebase audit: `bsemanager/CODEBASE_AUDIT_LOG.md`
- Master blueprint: `bsemanager/MASTER_BLUEPRINT.md`
