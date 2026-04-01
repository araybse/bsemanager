# IRIS Launch Master Plan
**Target Launch:** April 12, 2026 (12 days remaining)  
**Last Updated:** March 31, 2026 - 6:42 AM EST  
**Status:** 🔴 BLOCKED - Critical expense data issues found

---

## 🚨 CRITICAL BLOCKERS (Must Fix Before Launch)

### Issue #1: Duplicate Expenses Across All Projects
**Discovered:** March 31, 2026 (during 24-01 audit)
**Impact:** Financial data inaccurate, cost calculations wrong
**Status:** 🔴 BLOCKING LAUNCH

**What we found:**
- Project 24-01 had 20 expenses in IRIS, QB only has 13
- Duplicates included: 2x Godard $7,000, 3x SJRWMD $1,402.50, extra JEA entries
- Total difference: $5,283.55 extra in IRIS
- **Likely affects all 90 projects**

**What we did:**
- ✅ Manually cleaned 24-01 (deleted 9 duplicates, added 2 missing)
- ✅ 24-01 now matches QB exactly ($10,437.41)
- ⏳ 89 projects still need audit

**What needs to happen:**
1. Audit all 89 remaining projects (compare IRIS expenses to QB)
2. Manually clean duplicates for each project
3. Fix QB sync to prevent future duplicates
4. Verify all projects match QB after cleanup

**Estimated time:** 
- Manual audit: 15-20 min per project × 89 = 22-30 hours
- OR: Build automated comparison script = 2-3 hours + 1 hour cleanup per project

**Root cause:** Unknown - QB sync creating duplicates, need to investigate sync logic

---

### Issue #2: QB Sync Creates Duplicates
**Status:** 🔴 ROOT CAUSE UNKNOWN

**What we know:**
- Expenses sync from QB as "Purchase" transactions
- Duplicates appear with same date/vendor/amount but different source IDs
- Foreign key constraints prevent bulk delete (expenses linked to invoices)
- Partial cleanup corrupted data (stopped at 200 deletes)

**What needs investigation:**
1. Why does sync create duplicates?
2. Is it syncing the same transaction multiple times?
3. Are there unique identifiers we're missing?
4. Does it happen for other data types (invoices, time entries)?

**Next steps:**
- Review expense sync code in `src/lib/qbo/sync/domains/project-expenses.ts`
- Check for duplicate detection logic
- Add upsert logic instead of insert
- Test with fresh sync

---

### Issue #3: Dashboard Calculation Issues
**Status:** ✅ FIXED for 24-01, needs deployment + verification

**What was wrong:**
- Dashboard showed "C-phase revenue/cost" (excluded reimbursables)
- Example: 24-01 showed $122,693 revenue vs actual $127,978
- Contract labor double-counted in total cost

**What we fixed:**
- Changed to show TRUE totals (all invoices, all expenses)
- Removed contract labor from cost calculation (already in expenses)
- Preserved old logic in comments for potential revert

**File changed:** `src/app/(authenticated)/projects/[id]/page.tsx`

**Verification needed:**
- Test on 5-10 other projects
- Compare dashboard to QB
- Ensure multiplier calculations correct

**NOT YET PUSHED TO GITHUB OR DEPLOYED**

---

## ✅ COMPLETED (Backend)

### Task #1: Real-Time QB Webhook Sync
- Webhook endpoint working
- Signature verification enabled
- Issue: Receives test events only (not real events)
- Workaround: Manual sync works

### Task #2: QB Sync Route Splitting
- 6 domain routes created
- Parallel execution: 60-70% faster
- "Sync All" button wired correctly

### Task #3: Rate Resolution Function
- Canonical function created
- Resolution order: project → schedule → default → fallback
- Documented in `docs/RATE_RESOLUTION.md`

### Task #4: Financial Definition Freeze
- Single source of truth: `src/lib/financial/metrics.ts`
- Formulas documented

### Task #5: Invoice Delete Detection
- Soft delete logic implemented
- Preserves audit trail

### Task #6: Logo Design
- SVG specs created
- Integrated into login page

### Task #7: Role-Based Permissions (Backend)
- 51 RLS policies protecting 25 tables
- Middleware enforcement
- Helper function deployed

---

## ⏳ PENDING TESTING

### 1. Role-Based Visibility (RLS)
**Status:** Backend complete, needs manual testing

**Test as Admin (Austin):**
- [ ] Can see all projects
- [ ] Can access /accounting
- [ ] Can see rates and QB settings
- [ ] Can see all users

**Test as PM (Austin Burke):**
- [ ] Can only see assigned projects
- [ ] Blocked from /accounting
- [ ] Cannot see other PMs' projects
- [ ] Limited sidebar pages

**Test as Employee (Arber Met):**
- [ ] Auto-redirects to /timesheet
- [ ] Cannot see rates/costs
- [ ] Cannot see QB settings
- [ ] Cannot access accounting
- [ ] Limited sidebar (3 pages max)

**Estimated time:** 30 minutes

---

### 2. Financial Accuracy (All Projects)
**Status:** BLOCKED until expenses cleaned

**Once expenses fixed:**
- [ ] Spot-check 10 representative projects
- [ ] Compare IRIS to QB:
  - Revenue
  - Cost (labor + expenses)
  - Profit
  - Multiplier
- [ ] Document discrepancies
- [ ] Fix calculation bugs

**Estimated time:** 2-3 hours

---

### 3. Invoice & Time Entry Status
**Status:** Not tested since fixes deployed

**Verify:**
- [ ] Invoice status (paid/unpaid) matches QB
- [ ] Time entry billed/unbilled logic correct
- [ ] Feb 2026 and earlier = "Billed"
- [ ] March 2026+ = "Unbilled"

**Estimated time:** 1 hour

---

### 4. QB Sync Reliability
**Status:** Not stress-tested

**Test:**
- [ ] Run 3 full syncs (morning, afternoon, evening)
- [ ] Verify all 6 domains complete successfully
- [ ] Test error handling (what if QB offline?)
- [ ] Verify sync logs accurate
- [ ] Check for new duplicates after sync

**Estimated time:** 1 day (spread across multiple syncs)

---

### 5. Portal UI Completion
**Status:** Unknown which tabs are fully wired

**Test each tab:**
- [ ] Dashboard - complete?
- [ ] Invoices - complete?
- [ ] Time - complete?
- [ ] Expenses - complete?
- [ ] Team - complete?
- [ ] Contracts - complete?
- [ ] Accounting - complete?
- [ ] Settings - complete?

**For each tab, verify:**
- Loads without errors
- Displays correct data
- Filters work
- Actions work (edit, delete, etc.)

**Estimated time:** 2-3 hours

---

## 📋 OUTSTANDING ISSUES (From Prior Reviews)

### Minor Issues

**1. Test Invoice 27-xx-xx**
- Exists in IRIS but deleted in QB
- Needs manual deletion
- **Priority:** Low

**2. Console Errors**
- 14 errors + 3 warnings (non-blocking)
- Should we fix or ignore?
- **Priority:** Low

**3. Missing Tables**
- `invoice_billables` doesn't exist
- `project_team_assignments` doesn't exist
- Create now or later?
- **Priority:** Low (Phase 2)

**4. Time Entry Phase Filtering**
- Uses `phase_name` not `phase_code`
- May affect filtering by phase
- Is this expected behavior?
- **Priority:** Medium (if affects reports)

---

## 🎯 REVISED LAUNCH PLAN

### Phase 1: Fix Expense Data (3-5 days)

**Option A: Manual Audit (Slower, Accurate)**
- Day 1-2: Audit 30 projects
- Day 3-4: Audit 30 projects
- Day 5: Audit remaining 29 projects + verify
- **Total:** 5 days, 100% accuracy

**Option B: Automated Script (Faster, Riskier)**
- Day 1: Build comparison script
- Day 2: Run automated cleanup with review
- Day 3: Manual verification of flagged projects
- **Total:** 3 days, 95% accuracy

**Recommendation:** Option B (faster, allows manual review of edge cases)

---

### Phase 2: Fix QB Sync (1-2 days)

**Tasks:**
1. Review expense sync code
2. Add duplicate detection logic
3. Implement upsert instead of insert
4. Test with fresh sync
5. Verify no new duplicates created

---

### Phase 3: Testing & Verification (2-3 days)

**Day 1: Core Testing**
- RLS testing (all roles)
- Financial accuracy (10 projects)
- Dashboard calculations

**Day 2: System Testing**
- QB sync reliability (3 full syncs)
- Invoice/time status verification
- Portal UI completion check

**Day 3: Bug Fixes**
- Fix critical issues found
- Re-test fixed items
- Document known issues (Phase 2)

---

### Phase 4: Team Onboarding (2-3 days)

**Day 1: PM Soft Launch**
- Create PM accounts
- 30-min walkthrough
- Monitor for issues

**Day 2: PM Feedback**
- Collect feedback
- Fix critical issues
- Verify workflows

**Day 3: Full Team Launch**
- Create employee accounts
- Send announcement
- Monitor + support

---

## 📊 REVISED TIMELINE

**With expense cleanup:**
- April 1-3: Fix expense data (automated script)
- April 4-5: Fix QB sync + test
- April 6-8: System testing + verification
- April 9-10: Bug fixes + polish
- April 11: PM soft launch
- April 12: Full team launch

**Risk:** Tight timeline, expense cleanup may take longer

**Alternative (Conservative):**
- April 1-5: Fix expense data (manual audit)
- April 6-7: Fix QB sync + test
- April 8-10: System testing
- April 11-12: Bug fixes
- April 15: PM soft launch
- April 16: Full team launch

**Recommendation:** Conservative timeline (April 16 launch)

---

## 🚦 LAUNCH GATE CRITERIA

**Must be 100% before launch:**
- ✅ All 90 projects match QuickBooks (expenses cleaned)
- ✅ QB sync runs without creating duplicates (3/3 test syncs)
- ✅ Financial calculations accurate (10/10 spot checks pass)
- ✅ RLS working (all 3 roles tested and verified)
- ✅ All portal tabs functional (no broken pages)
- ✅ Zero critical bugs
- ✅ User documentation complete

**Nice to have but not required:**
- Advanced filters
- Reporting features
- Mobile responsiveness (beyond basic)
- Minor UI polish

---

## 🔧 IMMEDIATE NEXT STEPS

**Today (March 31):**
1. ✅ Complete 24-01 audit (DONE)
2. ⏳ Push dashboard calculation fix to GitHub
3. ⏳ Deploy to Vercel for testing
4. ⏳ Decide: Manual audit vs automated script for expense cleanup

**Tomorrow (April 1):**
1. Start expense cleanup (method TBD)
2. Begin QB sync investigation
3. Document expense sync logic

**This Week:**
- Focus 100% on expense data accuracy
- No new features, only fixes
- Daily progress updates

---

## 📝 DECISIONS NEEDED FROM AUSTIN

**Priority 1 (Today):**
1. **Expense cleanup method:** Manual audit or automated script?
2. **Launch date:** Keep April 12 or push to April 16?
3. **Push dashboard fix?** Ready to deploy code changes?

**Priority 2 (This Week):**
1. Should we fix console errors or ignore them?
2. Create missing tables now or Phase 2?
3. How should QB sync errors alert you? (Telegram/Email/Dashboard)

**Priority 3 (Next Week):**
1. Parallel ClickUp vs IRIS or hard cutover?
2. Which Phase 2 features are highest priority?

---

## 📞 COMMUNICATION PLAN

**Daily Standup (8 AM EST via Telegram):**
- What got done yesterday
- What's planned today
- Any blockers
- Status: On track / At risk / Behind

**Immediate alerts for:**
- Critical bugs found
- Sync failures
- Data corruption
- System downtime

**Weekly recap (Fridays):**
- Progress summary
- What's ready for next week
- Risks and concerns

---

## 🔄 ROLLBACK PLAN

**If launch fails:**
1. Revert Vercel deployment to last stable version (2 minutes)
2. Team continues using QuickBooks Desktop + Excel
3. No data lost (Supabase has full history)
4. Regroup and fix issues
5. Try again when stable

**This is low-risk:** Adding a tool, not replacing critical systems yet.

---

## 📁 REFERENCE FILES

**Current documentation:**
- `PHASE_1_OUTSTANDING_ITEMS.md` - Original detailed review (March 27)
- `IRIS_2WEEK_LAUNCH_PLAN.md` - Original timeline (March 29)
- `IRIS_AUDIT_2026-03-31.md` - Today's audit findings
- `BACKEND_TEST_REPORT.md` - Backend testing results
- `REVIEW_CHECKLIST.md` - Testing checklist
- `CODEBASE_AUDIT_LOG.md` - Code review findings

**This file replaces:** The above two planning docs (will be archived)

---

**Status:** Waiting for Austin's decisions on expense cleanup method and revised launch date.

**Next update:** After decisions made and work begins.
