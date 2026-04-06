# Time Dashboard - Testing Instructions

## Pre-Testing Setup

### 1. Deploy the Changes
```bash
cd ~/.openclaw/workspace/bsemanager
git add .
git commit -m "Fix Time Dashboard: user-specific data, PTO budgeting, default tab, data accuracy"
git push
```

### 2. Verify Build
The build already passed locally. After deployment, check:
- No console errors in browser
- All charts render correctly
- No TypeScript compilation errors

## Testing Scenarios

### Test 1: Default Tab
**Expected:** Dashboard tab should be selected by default

**Steps:**
1. Navigate to `/time` page
2. Observe which tab is active

**✅ Pass Criteria:**
- Dashboard tab is highlighted/active
- Dashboard content is visible
- NOT on Timesheet tab

---

### Test 2: Admin User Dropdown (Total Hours)
**Expected:** Admin sees user dropdown, can switch between users

**Steps:**
1. Login as admin
2. Go to Dashboard tab
3. Look at Total Hours card header

**✅ Pass Criteria:**
- User dropdown visible in top right of Total Hours card
- Can select different employees
- Chart updates when selection changes
- Data shows for selected user, not admin

---

### Test 3: Employee View (Total Hours)
**Expected:** Non-admin users see only their own data, no dropdown

**Steps:**
1. Login as employee (non-admin)
2. Go to Dashboard tab
3. Look at Total Hours card

**✅ Pass Criteria:**
- No user dropdown visible
- Chart shows only employee's own hours
- Cannot see other users' data

---

### Test 4: Total Hours Data Accuracy
**Expected:** All months show correct cumulative hours (Jan/Feb should NOT be 0)

**Steps:**
1. Select a user who has time entries in Jan/Feb 2026
2. View Total Hours chart for 2026
3. Check Jan and Feb values

**✅ Pass Criteria:**
- Jan shows hours (not 0)
- Feb shows cumulative Jan + Feb (not 0)
- Each month accumulates correctly
- No sudden jumps in March

**Debug Query (if failing):**
```sql
SELECT 
  TO_CHAR(entry_date, 'Mon') as month,
  SUM(hours::numeric) as monthly_total
FROM time_entries
WHERE employee_id = 'USER_ID'
  AND EXTRACT(year FROM entry_date) = 2026
GROUP BY TO_CHAR(entry_date, 'Mon'), EXTRACT(month FROM entry_date)
ORDER BY EXTRACT(month FROM entry_date);
```

---

### Test 5: PTO Usage - Calendar Year Only
**Expected:** PTO chart shows only 12 months of selected year

**Steps:**
1. Go to PTO Usage card
2. Select year 2026
3. Observe chart

**✅ Pass Criteria:**
- Shows exactly 12 data points (Jan-Dec)
- All months are from 2026
- No data from 2025 or 2027
- Year dropdown works (can switch years)

---

### Test 6: PTO Usage - Cumulative Line Chart
**Expected:** Line chart shows cumulative PTO, not monthly bars

**Steps:**
1. View PTO Usage chart
2. Observe chart type and data

**✅ Pass Criteria:**
- Line chart (not bars)
- Values increase monotonically (cumulative)
- Never decreases month-to-month
- Tooltip shows both monthly and cumulative

**Example:**
```
Jan: 8h  (cumulative: 8h)
Feb: 0h  (cumulative: 8h)
Mar: 16h (cumulative: 24h)
Apr: 8h  (cumulative: 32h)
```

---

### Test 7: PTO Budget Inputs (Current Year Only)
**Expected:** For current year, see input boxes for current/future months

**Steps:**
1. Select current year (2026) in PTO Usage
2. Look below the chart
3. Identify current month

**✅ Pass Criteria:**
- "Budget PTO for Upcoming Months" section visible
- Input boxes for current month and all future months
- No input boxes for past months
- Can enter numeric values (hours)

**Example (if today is Apr 6, 2026):**
- Inputs shown: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- No inputs: Jan, Feb, Mar

---

### Test 8: PTO Budgeted Line
**Expected:** When budget values entered, dashed line appears on chart

**Steps:**
1. In current year PTO chart
2. Enter budget hours for May: `16`
3. Enter budget hours for Jun: `8`
4. Observe chart

**✅ Pass Criteria:**
- Dashed line appears starting from current/future months
- Line includes budgeted amounts
- Legend shows "Budgeted PTO"
- Tooltip shows budgeted total when hovering

---

### Test 9: Employee Utilization - Period Selector
**Expected:** Period dropdown is in card header, not at top of page

**Steps:**
1. Go to Dashboard tab
2. Look at Employee Utilization card
3. Look at top of page

**✅ Pass Criteria:**
- Period dropdown (Month/Quarter/Year) is in card header (top right)
- No period selector at top of page
- Only user dropdown at top (if admin)
- Changing period updates Utilization chart only

---

### Test 10: Top-Level User Filter
**Expected:** Admin user dropdown at top affects all charts

**Steps:**
1. Login as admin
2. Select User A from top dropdown
3. Observe all three charts
4. Switch to User B
5. Observe all three charts again

**✅ Pass Criteria:**
- All 3 charts update when user changes
- Employee Utilization shows selected user's data
- PTO Usage shows selected user's data
- Total Hours shows selected user's data (also has its own dropdown)

---

## Edge Cases to Test

### Edge Case 1: User with No Data
**Steps:**
1. Select a user who has no time entries
2. View all charts

**✅ Pass Criteria:**
- Charts show "No data available" message
- No errors in console
- Page doesn't crash

---

### Edge Case 2: Year with No PTO
**Steps:**
1. Select a year where user took no PTO
2. View PTO Usage chart

**✅ Pass Criteria:**
- Flat line at 0
- All 12 months shown
- No errors
- Budget inputs still work (current year)

---

### Edge Case 3: Future Year Selection
**Steps:**
1. If year 2027 is in dropdown, select it
2. View PTO chart

**✅ Pass Criteria:**
- Shows empty/zero data (no future data)
- No budget inputs (not current year)
- No errors

---

### Edge Case 4: Budget Validation
**Steps:**
1. In PTO budget inputs, try:
   - Negative numbers
   - Decimal values (8.5)
   - Very large numbers (9999)
   - Text input

**✅ Pass Criteria:**
- Negative numbers: prevented or converted to 0
- Decimals: accepted (8.5 hours is valid)
- Large numbers: accepted but reasonable
- Text: ignored or converted to 0

---

## Performance Testing

### Test 11: Large Dataset
**Expected:** Charts load and render quickly even with many entries

**Steps:**
1. Select user with lots of time entries (hundreds)
2. Observe load time
3. Switch between years/users

**✅ Pass Criteria:**
- Initial load < 2 seconds
- Chart updates < 500ms
- No lag when switching selections
- Smooth animations

---

## Regression Testing

### Test 12: Timesheet Tab Still Works
**Steps:**
1. Click Timesheet tab
2. Verify functionality

**✅ Pass Criteria:**
- Timesheet loads correctly
- Can add/edit entries
- All existing features work
- Can switch back to Dashboard

---

### Test 13: Entries Tab Still Works
**Steps:**
1. Click Entries tab
2. Verify filtering and pagination

**✅ Pass Criteria:**
- Entries list loads
- Filters work
- Pagination works
- Can sort by date

---

### Test 14: Status Column Display
**Expected:** Status column shows badges with correct colors

**Steps:**
1. Go to Entries tab
2. Look at the table columns
3. Observe status badges

**✅ Pass Criteria:**
- Status column appears after Date column
- Each entry shows a status badge
- Draft entries: Gray badge
- Submitted entries: Amber/yellow badge
- Approved entries: Green badge
- Status text is capitalized ("Draft", "Submitted", "Approved")

**Database verification:**
```sql
SELECT 
  entry_date,
  employee_name,
  status,
  hours
FROM time_entries
ORDER BY entry_date DESC
LIMIT 20;
```

---

### Test 15: Status Badge Styling
**Expected:** Badges are visually distinct and readable

**Steps:**
1. View entries with different statuses
2. Check badge appearance

**✅ Pass Criteria:**
- Draft badge: Light gray background, dark gray text
- Submitted badge: Light amber background, dark amber text
- Approved badge: Light green background, dark green text
- Badges are small and compact (pill-shaped)
- Text is readable on all backgrounds
- Badges don't overflow or break layout

---

### Test 16: Status Column with Filters
**Expected:** Status column works with all existing filters

**Steps:**
1. Apply date range filter
2. Apply employee filter
3. Apply project filter
4. Observe status column in filtered results

**✅ Pass Criteria:**
- Status column remains visible after filtering
- Status badges display correctly for all filtered entries
- No layout issues or alignment problems
- Total row colspan is correct (6 columns total)

---

## Final Checklist

Before marking as complete:

- [ ] All 16 tests pass
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Charts render smoothly
- [ ] Responsive on mobile/tablet
- [ ] Admin and employee roles both tested
- [ ] Data accuracy verified with actual database queries
- [ ] PTO budgeting works for current year
- [ ] Default tab is Dashboard
- [ ] Top-level filtering is clean (admin only)

---

## Known Issues / Future Improvements

### Potential Enhancements:
1. **PTO Budget Persistence:** Currently budget inputs are local state only. Consider:
   - Save to database
   - Share budgets across sessions
   - Manager approval workflow

2. **Total Hours Target Customization:** 
   - Allow different targets per employee (not everyone works 2,000hrs/year)
   - Part-time employees might have different targets

3. **Export Functionality:**
   - Export chart data to CSV
   - Download charts as images

4. **Notifications:**
   - Alert when approaching PTO budget
   - Alert when behind hours target

### Technical Debt:
- Consider adding unit tests for chart components
- Add E2E tests with Playwright/Cypress
- Consider extracting chart logic into custom hooks
