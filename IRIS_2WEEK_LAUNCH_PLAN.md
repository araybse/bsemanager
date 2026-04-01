# IRIS 2-Week Launch Plan
**Goal:** Team launch by April 12, 2026  
**Created:** March 29, 2026  
**Status:** Planning

---

## Current State Assessment (March 29)

### ✅ What's Working
- QB sync connection established (all 6 domains syncing)
- Invoice status fix deployed (paid/unpaid showing correctly)
- Expenses table overflow fixed
- Authentication and roles working
- Basic portal structure complete

### ❌ What's Broken/Untested
- **No systematic testing** - changes deployed without verification
- **Invoice/Time status** - fixes deployed but not confirmed working with real data
- **Role visibility** (RLS) - not tested across all 25 tables
- **Financial calculations** - not verified for accuracy
- **QB sync reliability** - works but error handling untested
- **Missing visibility controls** - PM/Employee can see data they shouldn't

### 🚫 What We're NOT Doing (Phase 2)
- Permit tracking
- Task management  
- Advanced features
- New integrations

---

## The Problem

**We've been:**
- Making changes without proper testing
- Deploying fixes without verification
- Chasing bugs reactively
- No clear milestone tracking

**We need to:**
- Freeze feature changes
- Test everything systematically
- Fix only critical bugs
- Ship a stable Phase 1

---

## 2-Week Launch Schedule

### Week 1: Stabilization & Testing (Mar 29 - Apr 5)

#### **Monday, Mar 31 (Day 1)**
**Focus: Financial Audit**
- [ ] Run QB sync, capture before/after snapshots
- [ ] Pick 10 representative projects (mix of active/complete/various sizes)
- [ ] Manually verify against QuickBooks Desktop:
  - Revenue matches
  - Cost matches
  - Multiplier calculated correctly
  - Profit = Revenue - Cost
- [ ] Document any discrepancies
- [ ] Fix calculation bugs if found
- **Deliverable:** Financial accuracy report (pass/fail for each project)

#### **Tuesday, Apr 1 (Day 2)**
**Focus: Invoice & Time Entry Status**
- [ ] Verify invoice status (paid/unpaid) matches QB for all 340 invoices
- [ ] Check time entry billed/unbilled logic:
  - Feb 2026 and earlier should be "Billed"
  - March 2026 should be "Unbilled" (until March invoice goes out)
- [ ] Screenshot comparisons: IRIS vs QuickBooks
- [ ] Fix any mismatches
- **Deliverable:** Status validation report with screenshots

#### **Wednesday, Apr 2 (Day 3)**
**Focus: Role-Based Visibility (RLS)**
- [ ] Test as **Admin** (Austin): Can see everything
- [ ] Test as **PM** (Austin Burke): Can only see assigned projects
- [ ] Test as **Employee** (Arber Met): Cannot see rates, QB settings, accounting page
- [ ] Verify 25 tables with RLS policies enforce correctly
- [ ] Document what each role can/cannot see
- [ ] Fix any visibility leaks
- **Deliverable:** RLS test matrix (pass/fail per role per page)

#### **Thursday, Apr 3 (Day 4)**
**Focus: QB Sync Reliability**
- [ ] Run 3 full syncs (morning, afternoon, evening)
- [ ] Verify all 6 domains complete successfully each time
- [ ] Check error handling (what happens if QB is offline?)
- [ ] Verify sync logs are accurate
- [ ] Test manual vs automatic sync
- [ ] Fix any sync failures
- **Deliverable:** Sync reliability report (3/3 success rate required)

#### **Friday, Apr 4 (Day 5)**
**Focus: Portal Completion & UI Polish**
- [ ] Verify all tabs load without errors
- [ ] Check all dashboard cards show correct data
- [ ] Test filters on each page (date ranges, project selection)
- [ ] Verify navigation works (sidebar, breadcrumbs)
- [ ] Fix any broken links or missing pages
- [ ] Mobile/tablet layout check
- **Deliverable:** UI checklist (all pages functional)

#### **Saturday-Sunday, Apr 5-6 (Days 6-7)**
**Focus: Bug Fixes & Documentation**
- [ ] Fix all critical bugs found during Week 1
- [ ] Create user guide (1-2 pages max):
  - How to log in
  - How to view your projects
  - How to check time entries
  - Who to contact for help
- [ ] Create admin guide:
  - How to run QB sync
  - How to add/remove users
  - How to assign PMs to projects
- **Deliverable:** Bug-free system + user documentation

---

### Week 2: Team Onboarding & Launch (Apr 7 - Apr 12)

#### **Monday, Apr 7 (Day 8)**
**Focus: Final Pre-Launch Testing**
- [ ] Full system smoke test (Austin runs through all features)
- [ ] Create test accounts for 3 team members (don't give access yet)
- [ ] Verify all Week 1 fixes are deployed and working
- [ ] Run final QB sync
- [ ] Backup database (Supabase export)
- **Deliverable:** Launch readiness checklist (100% green)

#### **Tuesday, Apr 8 (Day 9)**
**Focus: Soft Launch - PMs Only**
- [ ] Create accounts for PMs:
  - Austin Burke
  - Wesley Koning
  - Chuck Kennedy
- [ ] Assign each PM to their projects
- [ ] Send login credentials + user guide
- [ ] 30-min walkthrough call (show them around)
- [ ] Ask them to use it for 2 days (no employees yet)
- [ ] Monitor for issues
- **Deliverable:** 3 PMs logged in and using system

#### **Wednesday, Apr 9 (Day 10)**
**Focus: PM Feedback & Fixes**
- [ ] Collect PM feedback (what's confusing, what's broken)
- [ ] Fix critical issues immediately
- [ ] Document "known issues" (non-critical items for Phase 2)
- [ ] Verify PMs can see only their projects
- [ ] Test PM workflows (checking time, reviewing invoices)
- **Deliverable:** PM feedback report + critical fixes deployed

#### **Thursday, Apr 10 (Day 11)**
**Focus: Employee Accounts Setup**
- [ ] Create accounts for all employees:
  - Arber Met
  - Others (how many total?)
- [ ] Assign employee role (limited access)
- [ ] Verify employees CANNOT see:
  - Rates/cost data
  - Other employees' time
  - QB settings
  - Accounting pages
- [ ] Test timesheet entry (if enabled)
- **Deliverable:** All employee accounts ready

#### **Friday, Apr 11 (Day 12)**
**Focus: Full Team Launch**
- [ ] Send credentials to all employees
- [ ] Send announcement email:
  - What IRIS is
  - How to log in
  - What you can see
  - Where to get help
- [ ] Monitor for login issues
- [ ] Be available for questions
- [ ] Run evening QB sync
- **Deliverable:** Full team using IRIS

#### **Saturday-Sunday, Apr 12-13 (Days 13-14)**
**Focus: Support & Stabilization**
- [ ] Monitor for errors/issues
- [ ] Fix any critical bugs
- [ ] Collect feedback
- [ ] Plan Phase 2 based on team requests
- **Deliverable:** Stable production system

---

## Success Criteria (Launch Gate)

**Required to launch:**
- ✅ Financial calculations 100% accurate (10/10 projects verified)
- ✅ Invoice/time status correct across all data
- ✅ RLS working (PMs see only their projects, employees can't see rates)
- ✅ QB sync runs without errors 3/3 times
- ✅ All portal pages load and display data correctly
- ✅ User documentation complete
- ✅ Admin tested successfully
- ✅ Zero critical bugs

**Nice to have but not required:**
- Advanced filters
- Reporting features
- Mobile app
- Anything Phase 2

---

## Rules for These 2 Weeks

### ✅ DO
- Test every change before deploying
- Fix bugs found during testing
- Document everything
- Ask Austin before adding ANY new features
- Take screenshots for verification
- Keep a daily status log

### ❌ DON'T
- Add new features (no matter how small)
- Deploy untested code
- Make "quick fixes" without verification
- Chase nice-to-have improvements
- Skip testing because "it should work"
- Deploy on Friday evening (deploy Mon-Thu only)

---

## Daily Standup Format

**Every morning at 8 AM (via Telegram):**

```
IRIS Launch Day [X/14]

✅ Yesterday:
- [What got done]
- [What was tested]
- [What was fixed]

🎯 Today:
- [What will be done]
- [What will be tested]
- [Expected completion time]

🚫 Blockers:
- [Anything blocking progress]
- [Decisions needed]

📊 Status:
- On track / At risk / Behind
```

---

## Emergency Contacts

**If something breaks during launch:**
1. Post in Telegram immediately
2. Don't try to fix it yourself without telling Austin
3. Document the error (screenshot + logs)
4. Decide: rollback or fix-forward?

**Rollback procedure:**
- Vercel → Deployments → Find last stable → Redeploy
- Takes 2 minutes
- Use if critical bug found during launch

---

## Phase 2 Parking Lot

**Things we want but are NOT doing in these 2 weeks:**

- Permit tracking
- Task management
- Email integration
- Meeting transcripts
- Advanced reporting
- Mobile app
- Time entry improvements (beyond basic view)
- Project profitability by phase
- Cash flow forecasting

**We'll prioritize Phase 2 based on:**
- Team feedback from Week 2
- Most-requested features
- Biggest pain points

---

## Communication Plan

**With team:**
- Apr 8: PM soft launch email
- Apr 11: Full team launch email
- Apr 12: Weekend status update
- Apr 14: Week 1 feedback survey

**With Austin:**
- Daily standup at 8 AM
- Immediate alerts for critical issues
- Friday recap (what's ready for next week)

---

## Metrics We're Tracking

**Week 1 (Testing):**
- # of bugs found
- # of bugs fixed
- # of tests passed/failed
- Financial accuracy score
- RLS test pass rate

**Week 2 (Launch):**
- # of users logged in
- # of support requests
- # of critical bugs
- User satisfaction (1-5 scale)
- System uptime %

---

## Rollback Plan

**If launch goes badly:**
- We can pull back to QuickBooks Desktop + Excel
- No data is lost (Supabase has full history)
- Team goes back to old workflow
- We regroup and try again

**This is low-risk:** We're adding a tool, not replacing critical systems (yet).

---

## Next Steps (Right Now)

1. **Austin approves this plan** (or suggests changes)
2. **I create Day 1 task list** (Monday financial audit)
3. **We start Monday morning** with financial verification
4. **Daily standups** keep us on track
5. **We ship on April 11** with confidence

---

**Last updated:** March 29, 2026, 9:58 AM EST  
**Owner:** Max (with Austin oversight)  
**Launch date:** April 11-12, 2026 (Friday-Saturday)  
**Team go-live:** April 11, 2026
