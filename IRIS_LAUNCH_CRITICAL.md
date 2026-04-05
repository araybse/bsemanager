# IRIS LAUNCH CRITICAL FEATURES

**Deadline:** April 12, 2026 (8 days remaining)

## 🚨 MUST-HAVE BEFORE TEAM LAUNCH

### 1. 2.25x Baseline Reference Line
**Status:** ✅ COMPLETE (not deployed yet)
- Added to Dashboard → Monthly Multipliers chart
- Added to Project Detail → Performance Over Time chart
- Red dashed line at 2.25x (baseline for $800K revenue goal)
- Gray dashed line at 3.0x (target)

**Action:** Deploy when approved

---

### 2. Employee Utilization & PTO Dashboard
**Status:** ⏳ TO DO
**Priority:** LAUNCH CRITICAL

**Must show:**
1. **Per Employee:**
   - PTO used vs. available (running balance)
   - Utilization rate (billable hours / total hours worked)
   - Monthly trend (last 6 months)
   - Alert if under-utilized (<70%) or over-utilized (>95%)

2. **Company-wide:**
   - Average utilization rate
   - Total PTO liability
   - Team capacity available
   - Trends over time

**Where to add:**
- Dashboard page (new card for admin/PM view)
- Could add employee detail pages later (post-launch)

**Data sources:**
- `time_entries` table (billable vs. non-billable hours)
- Need to add: PTO balance tracking (or pull from QuickBooks payroll?)

**Why critical:**
- Team needs to see if they're meeting productivity targets
- PMs need to know team capacity for project assignments
- Admin needs to manage PTO before it expires
- Directly impacts profitability (utilization = revenue)

---

## Timeline

**Today (April 4):** Scope & design utilization dashboard
**April 5-6:** Build utilization metrics & queries
**April 7-8:** Build dashboard UI
**April 9-10:** Testing & refinement
**April 11:** Final review with Austin
**April 12:** LAUNCH 🚀

