# IRIS Launch Plan - CURRENT
**Target Launch:** April 12, 2026 (10 days remaining)  
**Last Updated:** April 2, 2026 - 1:00 PM EST  
**Status:** 🟡 ON TRACK (tight timeline, monitoring closely)

---

## Context: Week of Launch Challenges

**Vicky's Surgery:**
- Tuesday April 8: Back surgery (Austin unavailable all day)
- Wed-Fri April 9-11: Austin home with kids, spotty availability

**Available Work Time:**
- **Mon-Fri 4-6:30 AM:** 2.5 hrs/day = 12.5 hours (prime time)
- **Sat-Sun:** Sleep in, recover (no early mornings)
- **Mon Apr 7:** Office day, ~4-5 hours between meetings
- **Wed-Fri scattered:** Maybe 2-3 hours total (if lucky)
- **Total estimate:** 35-40 hours through April 12

**Philosophy:**
- Discovery-driven approach (issues found as Austin works)
- Tag issues as "Launch Critical" or "Post-Launch" immediately
- Keep April 12 target, adjust if reality demands
- Quality over timeline on financial data

---

## 🔴 LAUNCH BLOCKERS (Must Fix)

### 1. Expense Data Crisis
**Status:** 🔴 CRITICAL  
**Time Estimate:** 22-30 hours (manual audit + cleanup)

**The Problem:**
- 89 of 90 projects have duplicate expenses
- Example: Project 24-01 had $5,283.55 extra expenses
- Root cause: QB sync creating duplicates (unknown why)
- Foreign key constraints prevent automated cleanup

**What Must Happen:**
1. Audit each project: Compare IRIS expenses to QuickBooks Desktop
2. Delete duplicates manually for each project
3. Verify totals match QB exactly
4. Fix QB sync logic to prevent future duplicates
5. Test fresh sync on 2-3 projects to confirm fix

**Progress:**
- ✅ Project 24-01 cleaned (March 31)
- ⏳ Projects 2-90: Need audit

**Risk:** If not fixed, team sees wrong financial data from day 1, system loses credibility.

---

### 2. Role-Based Access Testing
**Status:** 🔴 UNTESTED  
**Time Estimate:** 2-3 hours

**What Needs Testing:**
- **Admin (Austin):** Can see everything ✅ (working)
- **PM (Austin Burke):** Can ONLY see assigned projects ❌ (not tested)
- **Employee (Arber Met):** Cannot see rates, QB settings, accounting page ❌ (not tested)

**RLS Status:**
- 51 policies deployed across 25 tables (March 26 migration)
- Proposal phases RLS fixed (April 2)
- Backend test complete, frontend manual test pending

**What Must Happen:**
1. Login as Austin Burke (PM account)
2. Verify can only see his assigned projects
3. Verify cannot access /accounting page
4. Login as Arber Met (Employee account)
5. Verify cannot see rates, QB settings, sensitive data
6. Document any access control gaps

**Risk:** If not tested, employee might see confidential financial data on launch day.

---

### 3. Dashboard Calculation Accuracy
**Status:** 🟡 FIXED LOCALLY, NOT DEPLOYED  
**Time Estimate:** 2 hours (deploy + verify)

**What Was Fixed (March 31):**
- Changed from "C-phase only" revenue/cost to TRUE totals
- Removed contract labor double-counting
- File: `src/app/(authenticated)/projects/[id]/page.tsx`

**What Must Happen:**
1. Commit changes to GitHub
2. Deploy to Vercel production
3. Test on 5-10 representative projects
4. Compare dashboard numbers to QuickBooks
5. Verify multiplier calculations correct
6. Document formulas for team training

**Risk:** Team makes business decisions based on incorrect financial data.

---

### 4. QB Sync Duplicate Prevention
**Status:** 🔴 ROOT CAUSE UNKNOWN  
**Time Estimate:** 2-4 hours (investigate + fix)

**What Needs Investigation:**
1. Why does sync create duplicates?
2. Review expense sync code: `src/lib/qbo/sync/domains/project-expenses.ts`
3. Check for duplicate detection logic (missing?)
4. Add upsert logic instead of insert-only
5. Test with fresh sync on 2-3 projects

**What Must Happen:**
- Identify why duplicates happen
- Implement fix (unique constraint or upsert logic)
- Test on projects that had duplicates
- Verify no new duplicates created

**Risk:** Even after cleanup, new syncs create more duplicates, problem repeats.

---

## 🟡 SHOULD FIX (Not Launch Blockers)

### 5. QB Sync Route Role Checks
**Time:** 1 hour  
**Issue:** Service role client bypasses RLS, no explicit role validation  
**Fix:** Add role checks before allowing QB sync operations  
**Priority:** Medium (improve post-launch if time short)

### 6. Webhook Rate Limiting
**Time:** 30 minutes  
**Issue:** QB webhook endpoint has no rate limiting  
**Fix:** Add 10 req/min limit to prevent spam/DDoS  
**Priority:** Low (unlikely attack vector)

### 7. Formula Documentation
**Time:** 1 hour  
**Issue:** Team doesn't know how revenue/cost/multiplier calculated  
**Fix:** Write clear documentation of all financial formulas  
**Priority:** Medium (helps team trust the numbers)

---

## ✅ COMPLETED

- Real-time QB webhook sync (signature verification working)
- QB sync route splitting (6 domains, parallel execution)
- Rate resolution function (`getApplicableRate`)
- Financial definitions documented
- Invoice delete detection working
- Time Entry Billed Status system (ready to deploy)
- 14 dashboard improvements (ready to deploy)
- Applications tab restructured (ready to deploy)
- Phases tab columns renamed (ready to deploy)
- Backend comprehensive audit complete

---

## 🚫 OUT OF SCOPE (Phase 2)

These are explicitly NOT happening before launch:

- Permit tracking system
- Task management (ClickUp replacement)
- Advanced reporting features
- Additional integrations
- Mobile app
- Any new features beyond core portal

**Launch scope:** Stable financial portal with accurate data, basic QB sync, role-based access.

---

## TIMELINE & CAPACITY

### Available Hours (Apr 3-12)
| Day | Available | Notes |
|-----|-----------|-------|
| Fri Apr 3 | 2-3 hrs | Good Friday, kids home, light day |
| Sat Apr 4 | Variable | Sleep in, optional IRIS work |
| Sun Apr 5 | Variable | Sleep in, optional IRIS work |
| Mon Apr 6 | 7 hrs | 4-6:30 AM + office 4-5 hrs |
| Tue Apr 7 | 2.5 hrs | 4-6:30 AM only (Vicky's surgery) |
| Wed Apr 8 | 3 hrs | 4-6:30 AM + scattered (home with kids) |
| Thu Apr 9 | 3 hrs | 4-6:30 AM + scattered (home with kids) |
| Fri Apr 10 | 3 hrs | 4-6:30 AM + scattered (home with kids) |
| Sat Apr 11 | Variable | Final push if needed |
| Sun Apr 12 | Launch | Testing, deployment, team prep |

**Total Estimate:** 35-40 hours available

### Required Hours
| Task | Hours |
|------|-------|
| Expense cleanup | 22-30 |
| RLS testing | 2-3 |
| Dashboard deploy | 2 |
| QB sync fix | 2-4 |
| Documentation | 1 |
| Buffer for unknowns | 5 |
| **Total** | **34-45 hours** |

**Math:** Barely fits. No room for surprises or scope creep.

---

## DECISION FRAMEWORK

### Keep April 12 If:
- Expense cleanup can be compressed (focused sessions)
- Vicky's recovery goes smoothly (Austin has scattered time Wed-Fri)
- No major new issues discovered
- Willing to launch with "good enough" vs "perfect"

### Push to April 19 If:
- Vicky's surgery/recovery requires more attention
- Expense cleanup reveals more complex issues
- Critical bugs discovered in testing
- Team needs more training time

### Push to April 26 If:
- Family situation requires full week focus
- Data quality issues too severe to rush
- Multiple critical bugs found
- Want solid testing buffer

**Current Status:** Keep April 12 target, monitor daily, adjust without hesitation if needed.

---

## NEXT ACTIONS

### Immediate (Apr 3-5)
1. **Friday:** Wesley's drainage analysis, light email work
2. **Weekend:** Optional IRIS deep dive (expense cleanup if energy available)

### Week 1 Launch Push (Apr 6-9)
1. **Monday morning:** Start expense cleanup (batch first 10-15 projects)
2. **Monday office:** Continue cleanup, make calls (Niki, Kayla's Landing)
3. **Tuesday morning:** Expense cleanup batch 2 (before surgery)
4. **Wed-Fri mornings:** Expense cleanup batch 3-5 (as able with kids)

### Week 2 Final Push (Apr 10-12)
1. **Thursday-Friday:** RLS testing, dashboard deploy, QB sync fix
2. **Friday afternoon:** Team account setup, training prep
3. **Saturday:** Final testing, documentation, launch prep
4. **Sunday:** Team launch, monitoring, support

---

## SUCCESS CRITERIA

**Launch is GO when:**
- ✅ All 90 projects audited and cleaned (expenses match QB)
- ✅ PM and Employee roles tested and working correctly
- ✅ Dashboard calculations verified accurate on 10+ projects
- ✅ QB sync tested and not creating new duplicates
- ✅ Austin Burke and Arber Met accounts set up and tested
- ✅ Basic team training document written

**Launch is NO-GO if:**
- ❌ Expense data still wrong on majority of projects
- ❌ Critical security hole found in role-based access
- ❌ Dashboard calculations still inaccurate
- ❌ Family situation requires Austin's full attention

---

## RISK MITIGATION

**Biggest Risk:** Rushing expense cleanup and missing issues  
**Mitigation:** Spot-check 20% of cleaned projects for verification

**Second Risk:** Family emergency during launch week  
**Mitigation:** Keep team in loop, ready to push date if needed

**Third Risk:** Undiscovered critical bugs  
**Mitigation:** Austin tags as "launch critical" immediately when found

---

## LESSONS LEARNED

**From March 29-31:**
- Discovered expense crisis during first project audit (24-01)
- Realized need for systematic testing vs reactive bug fixes
- Learned QB sync creating duplicates (root cause still unknown)
- Found dashboard calculations were wrong (fixed locally)

**From April 1-2:**
- Vicky's surgery announcement changed launch week capacity
- Recognized need for discovery-driven approach vs rigid checklist
- Shifted focus from "perfect plan" to "responsive execution"
- Prioritized launch blockers over nice-to-haves

**Key Insight:**
Can't predict exact issues until hands-on work begins. Better to have flexible capacity + clear decision framework than detailed plan that goes stale immediately.

---

## COMMUNICATION PLAN

**Austin to Team:**
- Target: April 12 launch (subject to adjustment)
- Reason for delay (if needed): Data quality + family situation
- Expectation: Stable financial portal, not feature-complete

**Max to Austin:**
- Daily status updates (if working on IRIS)
- Immediate flag on any launch-critical issues discovered
- Time estimates on each new issue found
- Reality check on timeline as week progresses

---

**Last Updated:** April 2, 2026 - 1:00 PM EST  
**Next Review:** April 6, 2026 (after weekend, before launch week)
