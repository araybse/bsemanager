# BSE Manager Master Plan

**Version:** 1.0  
**Date:** March 24, 2026  
**Status:** Active Roadmap  

---

## Grand Vision

BSE Manager is the operational backbone that unifies design data, project delivery, labor tracking, billing, and project management into one seamless platform. It enables Blackstone to execute faster and more accurately while delivering competitive-differentiated depth and detail that sets us apart.

By Phase 4, BSE Manager becomes an intelligent operating system: context-aware AI agents assist project managers with everything from email correspondence to submittal processes, powered by unified project data, communication history, and regulatory context. PMs manage projects without losing track of anything.

---

## Phase 1: Foundation & Stabilization (NOW)

### Vision
Master database structure + web portal that organizes project lifecycle (proposal → contract → execution) with reliable QB sync, transparent accounting, and accurate financial calculations.

**Status:** Schema mostly complete. Portal ~70% UI wired. QB sync working. **Critical work:** Audit, RLS, team deployment.

### Deliverables

#### 1.1 Database Audit & Verification
- [ ] Verify all 90 projects sync correctly from QB
- [ ] Check: Every time entry has a resolved rate (time_entry_bill_rates populated)
- [ ] Check: Every invoice line item matches calculated amount (no drift)
- [ ] Check: Project financial totals match QB (revenue, cost, profit)
- [ ] Check: No denormalized `project_number` mismatches
- [ ] Verify sync_runs show successful imports with no silent truncations
- [ ] Document: Exactly one canonical formula for Revenue, Cost, Multiplier (frozen, immutable)

#### 1.2 Financial Definition Freeze
Write one function: `computeProjectFinancials(projectId)` that returns:
```
{
  revenue: sum of invoiced line items,
  laborCost: sum of labor costs (time entries × labor rate),
  expenseCost: sum of billable + non-billable project expenses,
  totalCost: laborCost + expenseCost,
  profit: revenue - totalCost,
  multiplier: revenue / totalCost (or custom formula),
  profitMargin: profit / revenue
}
```
- [ ] Implement in one backend function
- [ ] All UI components call this single function
- [ ] Document formula + assumptions
- [ ] Add unit tests with historical project data
- [ ] Verify dashboard, project detail, invoices all show same numbers

#### 1.3 Rate Resolution Hardening
Write function: `getApplicableRate(employeeId, title, projectId, forDate)` that:
- [ ] Walks employee_title_history for title on forDate
- [ ] Looks up proposal_rate_cards for that project/title/date
- [ ] Falls back to firm labor rates if no project-specific rate exists
- [ ] Returns: {rate, rateSource, rateSourceId, effectiveFrom}
- [ ] Add logging: which rate was used and why (for debugging)
- [ ] Test: Historical data consistency (same employee on same project gets same rate each time)

#### 1.4 Role-Based Visibility (RLS)
- [ ] Enable RLS on all 25 tables marked WARN (currently disabled)
- [ ] Implement role-based policies:
  - **admin**: Full access (all tables, all rows)
  - **project_manager**: Projects, invoices, time entries, labor costs (no rates, no settings)
  - **employee**: Own time entries + project-related data only (no billing, no financial)
  - **client**: (If enabled) Invoices + their project overview only
- [ ] Hide accounting sensitivity: Rates, QB settings, cost figures from non-admin
- [ ] Test: Employee logs in, cannot see billable rates or QB sync settings
- [ ] Test: PM logs in, can see projects + invoices but not rate tables

#### 1.5 QB Sync Reliability
- [ ] Split large sync/route.ts into modules (sync-customers, sync-invoices, sync-time, sync-expenses)
- [ ] Add explicit error handling + retry logic per domain
- [ ] Log each domain's import count (imported X of Y, skipped Z, errors A)
- [ ] Add data quality checks post-sync:
  - [ ] Every invoice total matches line items
  - [ ] Every time entry has a resolved rate
  - [ ] No duplicate syncs of same external entity
- [ ] Document sync expectations (time lag, failure recovery, manual intervention if needed)

#### 1.6 Web Portal Completion
- [ ] Dashboard: KPIs (backlog, AR, readiness) — verified accurate
- [ ] Projects List: Search, filter, group by year, archive toggle — tested
- [ ] Project Detail: All tabs wired (Overview, Phases, Invoices, Labor, Expenses, Contract Labor, Reimbursables)
- [ ] Invoices: List + expand for line items, filters, sort — tested
- [ ] Labor: Time entry list, by employee, by phase, filter by date range
- [ ] Calculations: All displayed totals verified against canonical formulas
- [ ] Error handling: User-friendly messages if QB sync fails or data is stale

### Completion Checklist
- [ ] All 90 projects pass financial audit (revenue/cost/profit match QB)
- [ ] Rate resolution logging shows consistent results
- [ ] RLS enforced, sensitive data hidden from non-admin
- [ ] QB sync shows successful imports + error summaries
- [ ] Web portal pages load correctly, calculations accurate
- [ ] All tests pass (unit + integration)
- [ ] Documentation: Data dictionary, QB sync flow, RLS policies
- [ ] Credentials ready: Users created with correct roles
- [ ] Team training: Brief walkthrough of portal + permissions

### Gate to Phase 2
**Phase 1 is complete when:**
1. Financial audit passes (100% accuracy on 90 projects)
2. RLS is enforced and tested
3. Team has deployed and provided feedback
4. Zero sync errors for 2 weeks (stable baseline)
5. "Master blueprint" document updated with final schema version

---

## Phase 2: Project Management Excellence (Planned)

### Vision
Enable project managers to execute faster with end-to-end visibility: financial insight, permit tracking, task management, and logged workflows. Replace ClickUp with integrated task + project workflow engine.

### Deliverables (Ordered by Priority)

#### 2.1 Permit Submittal & Approval Tracking (HIGHEST PRIORITY)
Permit module with:
- [ ] Permit intake (create new permit, link to project, set due dates)
- [ ] Submittal workflow (draft → review → submit to agency → track status)
- [ ] RFI tracking (log request → deadline → response → resolution)
- [ ] Approval log (who approved, when, comments)
- [ ] Timeline view (Gantt of permits + key dates)
- [ ] Escalation alerts (due in 2 days, overdue, missing docs)
- [ ] Integration: Link permits to project_info fields (agency, project type, regulatory requirements)

**Why first:** Permits are sequential, high-value, and time-sensitive. Direct ROI for PM productivity.

#### 2.2 Task Management (CLICKUP REPLACEMENT)
Task module with:
- [ ] Task creation (title, description, project, assignee, due date)
- [ ] Task status workflow (backlog → in progress → review → done)
- [ ] Subtasks + dependencies
- [ ] Comments + audit trail (who did what, when)
- [ ] Filters: By project, by assignee, by due date, by status
- [ ] Bulk actions (reassign, change due date, mark done)
- [ ] Calendar view (due dates on calendar)
- [ ] No external tool needed (stop using ClickUp)

#### 2.3 Logged Workflows & Audit Trails
Workflow engine with:
- [ ] Pre-defined workflows for common processes (permitting, invoicing, project closeout)
- [ ] Each step has: Owner, due date, completion status, log entry
- [ ] Automatic logging (system records: "Invoice finalized by Austin on 3/24/26")
- [ ] Manual notes (PMs add context: "Waiting for agency response")
- [ ] Compliance view (show complete audit trail for a project)

#### 2.4 Financial Insight Completion
Dashboard enhancements:
- [ ] Project profitability by phase (which phases are profitable?)
- [ ] Labor efficiency (hours budgeted vs actual)
- [ ] Expense tracking (reimbursable vs non-reimbursable)
- [ ] Cash flow forecast (when do invoices hit, when are expenses due?)
- [ ] Multiplier trends (are we pricing better or worse over time?)
- [ ] Compare: Proposed vs actual profitability

#### 2.5 Communication & Collaboration
- [ ] Project-level comments (team discussing deliverables in one place)
- [ ] Email integration starter (log external emails to project for context)
- [ ] File attachments (upload permits, agency letters, calculations)
- [ ] @mentions (notify PMs of updates)

### Phase 2 Completion Criteria
- Team uses portal for 100% of permit tracking (no external sheets)
- ClickUp replaced with integrated task management
- All workflows logged and auditable
- Zero lost context (everything in one place)
- Team reports: "I can see everything I need without switching tabs"

### Gate to Phase 3
**Phase 2 is complete when:**
1. Permit + task modules are stable and team-tested
2. ClickUp is decommissioned (all tasks migrated)
3. Financial dashboards show accurate, actionable insights
4. Workflows are documented and used consistently

---

## Phase 3: Design Tools & Integration (Future)

### Vision
Streamline design process so engineers do more engineering and less drafting. Leverage organized project data to create new products and competitive advantages.

### Deliverables

#### 3.1 Design Data Hub
- [ ] Central repository for all project design artifacts (CAD files, calculations, specs, site analysis)
- [ ] Versioning (track changes, revert if needed)
- [ ] Linking (design doc references project_info fields, updates propagate)
- [ ] Searchability (find calculations, standards, precedents across all projects)

#### 3.2 AutoCAD Plugin
- [ ] Read/write design data from BSE Manager database
- [ ] Push calculated geometry to CAD (streets, lot lines, utilities)
- [ ] Pull design updates back to database (finalized grading, utilities)
- [ ] Reduce manual drafting, accelerate plan production

#### 3.3 Spreadsheet Logic → Custom Tools
- [ ] Migrate legacy spreadsheets (grading calcs, stormwater sizing, cost estimation) to database logic
- [ ] Build custom calculation engines that:
  - [ ] Pull input data from project_info
  - [ ] Apply firm standards and precedents
  - [ ] Generate reports + outputs automatically
  - [ ] Reduce manual calculation errors

#### 3.4 Modeling Software Integration
- [ ] HEC-RAS / WaterCAD / StormWise integration
- [ ] Automated input generation from project data
- [ ] Automated result import + interpretation
- [ ] New products: Stormwater reports, utilities analysis, cost estimates

#### 3.5 New Revenue Products
- [ ] Construction cost estimation (labor + materials + overhead calculated from organized data)
- [ ] Land feasibility analysis (zoning, utilities, entitlements, cost + revenue modeling)
- [ ] Project timeline forecasting (based on permit history + historical delivery data)

### Phase 3 Completion Criteria
- Design engineers report: "I spend way less time on manual drafting"
- Cost estimates generated in hours instead of days
- New product revenue: Feasibility studies, cost analyses sold to clients

---

## Phase 4: AI Agents & Intelligent Automation (Vision)

### Vision
Transform BSE Manager into an intelligent operating system. AI agents understand project context (data + history + communication) and assist PMs with everything from email to submittals.

### Data Integration Foundation
For Phase 4 to work, Phase 1-3 must include:
- [ ] Email integration (MS Graph API): Pull project-related emails into context
- [ ] Meeting transcripts (Plaud or similar): Log calls, transcribe, link to project
- [ ] Manual notes: PMs add context, agent learns from it
- [ ] Agency documentation: Store permits, requirements, approval letters
- [ ] Complete audit trail: Every action logged with timestamp + actor + reasoning

### Agent Capabilities (Envisioned)
- **Email Assistant**: Draft responses to agency RFIs, vendor inquiries, client updates
- **Submittal Agent**: Track what's due, what's been sent, what's been approved
- **Project Intelligence**: "What's the blocker on this permit?" "Why is labor cost over budget?"
- **Risk Detection**: "This phase is headed off-track, here's why"
- **Compliance**: "This doesn't match agency standards" before you submit

### Phase 4 Completion
- PMs rely on AI agents for routine communication and tracking
- No manual email drafts or permit checklists
- Proactive alerts (blockers, risks, opportunities)
- Documented competitive advantage

---

## Architectural Principles (Apply to All Phases)

### 1. One Source of Truth
- Every KPI (Revenue, Cost, Multiplier, etc.) has one canonical calculation
- All UI components call the same backend function
- Changes to formulas are made in one place, visible everywhere

### 2. Immutable Historical Data
- Time entries, invoices, rates are immutable once recorded
- Corrections are logged as amendments, not overwrites
- Financial history remains auditable

### 3. Effective-Dated Records
- Rates, workflows, agency requirements are effective-dated
- "As of this date, X was true" — supports historical analysis
- Phase 4 AI agents need this context

### 4. Complete Audit Trails
- Every action: User, timestamp, old value, new value, reason
- Supports compliance + debugging
- Required for Phase 4 AI context

### 5. Role-Based Access
- Sensitive data (rates, QB settings, costs) hidden from non-admin
- Each role sees exactly what they need
- Enforced via RLS at database level

### 6. Sync Safety
- External systems (QB, autocad, email) are read-only or carefully gated
- Sync failures logged + alertable, never silent
- Data quality checks post-sync

### 7. API-First Design
- Frontend calls documented APIs
- Enables Phase 4 AI agents to operate on same APIs as humans
- Automation becomes "calling existing endpoints"

---

## Known Technical Risks & Paydown

| Risk | Impact | Mitigation | Timeline |
|------|--------|-----------|----------|
| Financial definition drift | Wrong decisions, lost trust | Freeze formula (Phase 1) | This week |
| Denormalized project_number mismatches | Data integrity, sync confusion | Audit all 90 projects | Phase 1 |
| RLS disabled on 25 tables | Sensitive data exposed | Enable + test all (Phase 1) | Phase 1 |
| Large sync route coupling | Partial failures, hard to debug | Split by domain (Phase 1) | Phase 1 |
| Rate resolution unclear | Billing errors, inconsistency | Hardened function + logging (Phase 1) | Phase 1 |
| Email integration missing | Phase 4 AI can't read context | Add MS Graph (Phase 3) | Phase 3 |
| No transcript ingestion | AI lacks communication history | Integrate Plaud (Phase 3-4) | Phase 3-4 |

---

## Before You Build X: Checklist

**Before building ANY Phase 2 feature:**
- [ ] Phase 1 financial audit passed (100%)
- [ ] RLS enforced + tested
- [ ] Team deployed + stable for 2 weeks
- [ ] Zero sync errors for 7 days

**Before building ANY Phase 3 feature:**
- [ ] Phase 2 is shipped + team-tested
- [ ] Permit + task modules stable
- [ ] ClickUp decommissioned

**Before building ANY Phase 4 feature:**
- [ ] Phases 1-3 complete + stable
- [ ] Email/transcript integration in place
- [ ] Complete audit trails on all entities
- [ ] AI model selected + trained on project data

---

## Success Metrics

### Phase 1
- Financial audit: 100% accuracy on 90 projects
- RLS enforcement: Zero sensitive data leaks
- Team adoption: 100% using portal for daily work
- Sync reliability: 99.5% success rate, <1% retry rate

### Phase 2
- Task migration: 100% of ClickUp tasks in BSE Manager
- Permit tracking: Zero missed agency deadlines
- PM feedback: "I have everything I need in one place"
- Time saved: Measure hours spent on manual tracking

### Phase 3
- Design cycle time: 30% faster plan production
- New product revenue: $X from feasibility studies
- Calculation accuracy: Zero errors on cost estimates

### Phase 4
- AI agent adoption: 80% of PM communication assisted
- Risk detection: AI flags issues before they blow up
- Competitive differentiation: Only Blackstone can deliver this level of detail

---

## Timeline Estimate

- **Phase 1:** 4-6 weeks (audit, RLS, deploy)
- **Phase 2:** 8-12 weeks (permits, tasks, workflows)
- **Phase 3:** 12-16 weeks (design tools, integrations)
- **Phase 4:** 8-12 weeks (AI setup, agent training, rollout)

**Total:** ~9 months for full vision (Phases 1-4 complete)

---

## Document Governance

This document is the north star. Update it when:
- Phase completion changes (refactor into next phase)
- Business priorities shift
- Technical risks emerge or resolve
- Success metrics change

Last updated: March 24, 2026
