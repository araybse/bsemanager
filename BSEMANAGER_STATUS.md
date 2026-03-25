# BSE Manager - Phase 1 Status Tracker

**Last Updated:** March 24, 2026  
**Phase:** 1 (Foundation & Stabilization)  
**Status:** Audit & RLS Hardening  

---

## Phase 1 Completion Checklist

### 1.1 Database Audit & Verification
- [ ] Verify all 90 projects sync correctly from QB
- [ ] Check: Every time entry has a resolved rate
- [ ] Check: Every invoice line item matches calculated amount
- [ ] Check: Project financial totals match QB
- [ ] Check: No denormalized `project_number` mismatches
- [ ] Verify sync_runs show successful imports
- [ ] Document: Freeze canonical formula (Revenue, Cost, Multiplier)

**Progress:** 0/7 — Not started  
**Blocker:** None identified  
**Owner:** Austin (review), Max (audit support)  

### 1.2 Financial Definition Freeze
- [ ] Write `computeProjectFinancials(projectId)` function
- [ ] All UI components call this single function
- [ ] Unit tests with historical data
- [ ] Verify dashboard/project detail/invoices match

**Progress:** 0/4 — Not started  
**Blocker:** Audit findings may require adjustments  
**Owner:** Austin  

### 1.3 Rate Resolution Hardening
- [ ] Write `getApplicableRate(employee, title, project, date)` function
- [ ] Add logging (which rate used, why)
- [ ] Test: Historical consistency
- [ ] Document: Rate precedence rules

**Progress:** 0/4 — Not started  
**Blocker:** None identified  
**Owner:** Austin  

### 1.4 Role-Based Visibility (RLS)
- [ ] Enable RLS on 25 tables (currently WARN)
- [ ] Implement role policies (admin, PM, employee, client)
- [ ] Hide accounting sensitivity (rates, QB settings, cost)
- [ ] Test: Employee cannot see rates; PM cannot see QB settings

**Progress:** 0/4 — Not started  
**Blocker:** Currently 25 tables have RLS disabled  
**Owner:** Austin  

### 1.5 QB Sync Reliability
- [ ] Split sync/route.ts into domain modules
- [ ] Add error handling + retry logic
- [ ] Log import counts (X of Y, skipped Z, errors A)
- [ ] Add data quality checks post-sync

**Progress:** 0/4 — Not started  
**Blocker:** Route complexity may require refactoring  
**Owner:** Austin  

### 1.6 Web Portal Completion
- [ ] Dashboard: KPIs verified accurate
- [ ] Projects List: All features tested
- [ ] Project Detail: All tabs wired + tested
- [ ] Invoices: Expand/filter/sort working
- [ ] Labor: Filters by date/employee/phase
- [ ] Calculations: Verified vs canonical formula
- [ ] Error handling: User-friendly messages

**Progress:** 0/7 — Need to assess current state  
**Blocker:** Unknown until reviewed  
**Owner:** Austin  

---

## Current Known Issues

1. **Financial definition drift** — Multiple billed/cost definitions may exist in codebase
   - Status: Not yet diagnosed
   - Impact: Decisions based on wrong data
   - Fix: Freeze formula in one function

2. **RLS disabled on 25 tables** — Sensitive data may be visible to non-admin
   - Status: Confirmed in advisor output
   - Impact: Security + compliance issue
   - Fix: Enable RLS + test per role

3. **Denormalized project_number** — Copied across 3+ tables
   - Status: Not yet audited
   - Impact: Mismatch risk if project number changes
   - Fix: Verify consistency, consider foreign keys

4. **Large sync route** — Single route.ts file handling all QB domains
   - Status: Confirmed from code review
   - Impact: Hard to debug, partial failures unclear
   - Fix: Split by domain

5. **Rate resolution** — Unclear if rates are consistently applied
   - Status: Not yet traced through codebase
   - Impact: Billing errors
   - Fix: Write canonical function, add logging

---

## Phase 1 Dependencies & Gates

**Cannot start Phase 2 until:**
1. ✓ Financial audit passes (100% accuracy on 90 projects)
2. ✓ RLS enforced and tested
3. ✓ Team deployed + stable for 2 weeks
4. ✓ Zero sync errors for 7 days

---

## Team Deployment Readiness

**Before credentials issued:**
- [ ] All portal pages functional
- [ ] Calculations verified accurate
- [ ] RLS tested (role separation confirmed)
- [ ] Training documentation ready
- [ ] Support plan (who answers questions)

**Users to create:**
- Austin (admin)
- Your team members (project_manager or employee role)

---

## Next Steps

1. **This week:** Diagnostic audit (assess current state of all 6 checklist items)
2. **Week 2:** Fix critical issues (RLS, financial formula)
3. **Week 3:** Harden rate resolution + sync safety
4. **Week 4:** Team deployment + 2-week stability baseline

---

## Notes

- Phase 1 is the foundation. Everything in Phases 2-4 depends on this being bulletproof.
- Financial accuracy is non-negotiable. If QB and the portal show different numbers, that's a show-stopper.
- RLS is critical before team access. Employees shouldn't see rates or QB settings.
- Once Phase 1 ships, we don't revisit the schema — it's locked. Future phases build on top.
