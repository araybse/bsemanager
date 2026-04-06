# IRIS UI Improvements - Visual Testing Guide

**Date:** April 6, 2026  
**Purpose:** Step-by-step visual verification of all 13 UI changes

---

## Test Environment Setup

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Login as Admin:**
   - Navigate to `/login`
   - Use admin credentials
   - Required for testing admin-only features

3. **Navigate to Time page:**
   - Click "Time" in main navigation
   - You should see 4 tabs: Dashboard, Timesheet, Entries, Approvals

---

## Dashboard Tab Tests (Tasks 1-8)

### Test 1: PTO Tooltip with Weeks ✅
**Location:** Dashboard → Paid Time Off chart

**Steps:**
1. Hover over any data point on the PTO chart
2. Tooltip should appear

**Expected:**
- Cumulative line should show: "160h (20.0 d, 4.0 wk)"
- Example for 160 hours: **20.0 days, 4.0 weeks**
- Formula verified: 160 ÷ 40 = 4.0 weeks

**Visual Check:**
```
✓ Shows hours (e.g., "160h")
✓ Shows days with "d" abbreviation (e.g., "20.0 d")
✓ Shows weeks with "wk" abbreviation (e.g., "4.0 wk")
```

---

### Test 2: Summary Cards Centered ✅
**Location:** Dashboard → Small cards left of charts

**Steps:**
1. Look at "Avg Utilization" card (left of Utilization chart)
2. Look at "Total PTO" card (left of PTO chart)

**Expected:**
- **Main value** (e.g., "75%", "160h") centered horizontally
- **Descriptor text** (e.g., "Month average", "Year to date") centered horizontally
- Both vertically centered in card body

**Visual Check:**
```
Avg Utilization Card:
┌─────────────────────┐
│ Avg Utilization     │ ← Title (top)
├─────────────────────┤
│                     │
│       75%          │ ← Centered value
│   Month average    │ ← Centered descriptor
│                     │
└─────────────────────┘

Total PTO Card:
┌─────────────────────┐
│ Total PTO           │ ← Title (top)
├─────────────────────┤
│                     │
│      160h          │ ← Centered value
│  Year to date      │ ← Centered descriptor
│                     │
└─────────────────────┘
```

---

### Test 3: PTO Chart - Data Labels Without "h" ✅
**Location:** Dashboard → Paid Time Off chart

**Steps:**
1. Look at data point labels above each month's dot

**Expected:**
- Labels show numbers only: "24.0", "48.0", "72.0"
- **NO "h" suffix** (previously showed "24.0h")

**Visual Check:**
```
Before: 24.0h ← Had "h"
After:  24.0  ← No "h"
```

---

### Test 4: PTO Chart - Y-Axis Fixed at 200 Max ✅
**Location:** Dashboard → Paid Time Off chart

**Steps:**
1. Look at Y-axis (left side of chart)

**Expected:**
- **Domain:** 0 to 200 (fixed, doesn't auto-scale)
- **Tick marks:** 0, 40, 80, 120, 160, 200
- **Label:** "Cumulative Hours" centered vertically, no cutoff

**Visual Check:**
```
200 ─┐
160 ─┤
120 ─┤  C
 80 ─┤  u
 40 ─┤  m
  0 ─┘  Hours (centered, visible)
```

---

### Test 5: PTO Chart - Legend Removed ✅
**Location:** Dashboard → Paid Time Off chart

**Steps:**
1. Look below the chart

**Expected:**
- **NO legend** showing "Actual PTO", "Budgeted PTO"
- Chart should be clean without legend (redundant info)

**Visual Check:**
```
Before:
[Chart]
■ Actual PTO  - - - Budgeted PTO ← Had legend

After:
[Chart]
(no legend) ← Clean
```

---

### Test 6: PTO Chart - Title Renamed ✅
**Location:** Dashboard → PTO chart title

**Steps:**
1. Look at card title at top

**Expected:**
- Title reads: **"Paid Time Off"**
- NOT "PTO Usage"

**Visual Check:**
```
Before: "PTO Usage"
After:  "Paid Time Off" ✓
```

---

### Test 7: Total Hours Chart - Y-Axis Label Centered ✅
**Location:** Dashboard → Total Hours chart

**Steps:**
1. Look at Y-axis label (rotated text on left)

**Expected:**
- Label reads: "Cumulative Hours"
- **Centered vertically** along Y-axis
- **No overflow or cutoff**

**Visual Check:**
```
Centered:
┌──┐
│ C│
│ u│
│ m│
│ u│  ← Vertically centered
│ l│
│ a│
│ t│
└──┘
```

---

### Test 8: Total Hours Chart - Correct Employee Data ✅
**Location:** Dashboard → Total Hours chart

**Admin Test Steps:**
1. Select "Austin Burke" from employee dropdown (top of page)
2. Look at Total Hours chart data
3. Check January/February values

**Expected:**
- Chart shows **only Austin Burke's hours**, not sum of all employees
- If Jan/Feb show 0, it means he has no entries (not a bug)
- Switching employees should update the chart

**Debug Steps if Wrong:**
1. Open DevTools → Network tab
2. Select different employee
3. Check API call: `/api/dashboard/total-hours?userId=<employee_id>`
4. Verify `userId` parameter changes with dropdown

**Visual Check:**
```
✓ Dropdown changes → Chart updates
✓ Single employee data (not combined)
✓ Jan/Feb 0 = no data (not calculation error)
```

---

## Timesheet Tab Tests (Task 9)

### Test 9: Admin Can Edit Any Timesheet ✅
**Location:** Timesheet tab

**Steps:**
1. Click "Timesheet" tab
2. As admin, select another employee from dropdown
3. Try to click a cell and edit hours

**Expected:**
- **Can edit** cells (previously read-only)
- Notice says: "Viewing timesheet for another employee" (no "read-only" text)
- Hours can be changed and saved

**Visual Check:**
```
Before:
"Viewing timesheet for another employee (read-only)"
Cells grayed out ✗

After:
"Viewing timesheet for another employee"
Cells editable ✓
```

---

## Approvals Tab Tests (Tasks 10-13)

**Note:** Approvals tab only visible to admins

### Test 10: Approvals Table Height Increased ✅
**Location:** Approvals tab

**Steps:**
1. Click "Approvals" tab
2. Look at table container height

**Expected:**
- Table is **taller** (600px fixed height)
- Shows more rows without scrolling
- About 50% taller than before

**Visual Check:**
```
Before: ~400px (flexible)
After:  600px (fixed) ← Taller
```

---

### Test 11: Date Column Sortable ✅
**Location:** Approvals tab → Date column header

**Steps:**
1. Click on "Date" column header
2. Click again to toggle

**Expected:**
- **First click:** Sort ascending (oldest first) - shows ↑ arrow
- **Second click:** Sort descending (newest first) - shows ↓ arrow
- Rows reorder by date
- Both submitted and approved entries sorted

**Visual Check:**
```
Date ↑  ← Ascending
Date ↓  ← Descending
```

---

### Test 12: Mark As Approved/Unapproved Buttons ✅
**Location:** Approvals tab → Top right buttons

**Steps:**
1. Select one or more **submitted** entries (checkbox)
2. Click "Mark As Approved"
3. Verify entries move to approved section

4. Select one or more **approved** entries (checkbox)
5. Click "Mark As Unapproved"
6. Verify entries move back to submitted section

**Expected:**
- **"Mark As Approved"** button:
  - Enabled when entries selected
  - Disabled (grayed) when nothing selected
  - Changes submitted → approved

- **"Mark As Unapproved"** button:
  - Enabled when entries selected
  - Disabled (grayed) when nothing selected
  - Changes approved → submitted

**Visual Check:**
```
No selection:
[Mark As Approved]      ← Grayed/disabled
[Mark As Unapproved]    ← Grayed/disabled

With selection:
[Mark As Approved]      ← Enabled (blue)
[Mark As Unapproved]    ← Enabled
```

---

### Test 13: Select All Checkbox ✅
**Location:** Approvals tab → Leftmost column header

**Steps:**
1. Look at table header row, first column
2. Click the checkbox

**Expected:**
- **Checkbox in header** (above individual row checkboxes)
- **Click once:** All entries selected (both submitted and approved)
- **Click again:** All entries deselected
- Checkmark shows when all selected

**Visual Check:**
```
Table Header:
┌─────┬──────┬──────────┐
│ [✓] │ Date │ Employee │ ← Select all checkbox
├─────┼──────┼──────────┤
│ [ ] │ 1/15 │ John     │
│ [ ] │ 1/16 │ Jane     │

After clicking header:
┌─────┬──────┬──────────┐
│ [✓] │ Date │ Employee │ ← Checked
├─────┼──────┼──────────┤
│ [✓] │ 1/15 │ John     │ ← All selected
│ [✓] │ 1/16 │ Jane     │ ← All selected
```

---

## Edge Cases to Test

### Total Hours - Empty Months
**Scenario:** Employee with no entries in Jan/Feb 2025

**Expected Behavior:**
- Chart shows 0 for those months (correct)
- NOT a bug - just no data
- Cumulative doesn't "reset" - it stays at last value

### Approvals - Mixed Selection
**Scenario:** Select both submitted and approved entries

**Expected Behavior:**
- "Mark As Approved" only acts on submitted entries
- "Mark As Unapproved" only acts on approved entries
- Smart filtering prevents invalid status changes

### Timesheet - Non-Admin Viewing Others
**Scenario:** Non-admin user tries to view another employee's timesheet

**Expected Behavior:**
- Employee dropdown NOT visible to non-admins
- Can only see their own timesheet
- No "viewing others" notice

---

## Quick Verification Checklist

Copy this to track your testing:

```
Dashboard Tab:
[ ] 1. PTO tooltip shows weeks (e.g., "4.0 wk")
[ ] 2. Summary cards centered (value + text)
[ ] 3. PTO labels without "h" (e.g., "24.0" not "24.0h")
[ ] 4. PTO y-axis 0-200 with ticks at 0,40,80,120,160,200
[ ] 5. PTO legend removed
[ ] 6. PTO chart titled "Paid Time Off"
[ ] 7. Total Hours y-axis label centered
[ ] 8. Total Hours shows correct employee (not sum of all)

Timesheet Tab:
[ ] 9. Admin can edit other employees' timesheets

Approvals Tab:
[ ] 10. Table height 600px (taller)
[ ] 11. Date column sortable (click header, shows ↑/↓)
[ ] 12. Mark As Approved/Unapproved buttons work
[ ] 13. Select all checkbox in header works

Build:
[ ] npm run build succeeds
```

---

## Troubleshooting

### Issue: Total Hours showing sum of all employees
**Fix:** Check employee dropdown actually changes userId parameter
**Debug:** DevTools → Network → Check API call has correct userId

### Issue: Approvals buttons always grayed
**Fix:** Make sure you're selecting entries (click checkboxes)
**Debug:** Check selectedEntries state in React DevTools

### Issue: Can't edit other employee's timesheet as admin
**Fix:** Verify you're logged in as admin role
**Debug:** Check userRole in browser console

### Issue: PTO chart y-axis not at 200
**Fix:** Clear browser cache, rebuild
**Debug:** Check pto-usage-chart.tsx line 119 has domain={[0, 200]}

---

**Testing Completed:** ___/___/___  
**Tested By:** ________________  
**Issues Found:** ______________  
**Sign-off:** ✅ All tests passed
