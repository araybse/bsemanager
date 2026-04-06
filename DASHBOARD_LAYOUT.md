# Time Dashboard - New Layout

## Before vs After

### BEFORE:
```
┌─────────────────────────────────────────────────────────┐
│ Time Page                                               │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Dashboard] [Timesheet*] [Entries]               │ <- Default was Timesheet
├─────────────────────────────────────────────────────────┤
│ Top Filters:                                            │
│   [User Dropdown (admin)] [Period: Month/Quarter/Year] │ <- Period at top
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Employee Utilization                                │ │
│ │ (Bar chart - last 12 months)                        │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ PTO Usage                                           │ │
│ │ (Bar chart - last 12 months)                        │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Total Hours                     [Year: 2026]        │ │
│ │ (Line chart - no user selector)                     │ │
│ │ Issue: Jan/Feb showing 0                            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### AFTER:
```
┌─────────────────────────────────────────────────────────┐
│ Time Page                                               │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Dashboard*] [Timesheet] [Entries]               │ <- Default is Dashboard
├─────────────────────────────────────────────────────────┤
│ Top Filter (admin only):                                │
│   [User Dropdown] (affects all charts)                 │ <- Just user dropdown
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Employee Utilization       [Period: Month ▼]        │ │ <- Period in card
│ │ (Line chart with 80% target line)                   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ PTO Usage                         [Year: 2026 ▼]    │ │ <- Year in card
│ │ (Cumulative line chart - calendar year only)        │ │
│ │ ─── Actual PTO                                      │ │
│ │ ┄┄┄ Budgeted PTO (future months)                    │ │
│ │                                                     │ │
│ │ Budget PTO for Upcoming Months:                     │ │
│ │ Apr [___] May [___] Jun [___] ...                   │ │ <- Budget inputs
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Total Hours    [User: John ▼] [Year: 2026 ▼]       │ │ <- User dropdown!
│ │ (Cumulative line chart vs 2,000hr target)           │ │
│ │ ─── Actual Hours                                    │ │
│ │ ┄┄┄ Target (2,000 hrs/year)                         │ │
│ │ Fixed: All months show correct cumulative data      │ │ <- Data fixed
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Key Improvements

### 1. Default Tab
- **Before:** Timesheet tab was default
- **After:** Dashboard tab is default

### 2. Top-Level Controls
- **Before:** Both user dropdown AND period selector
- **After:** Only user dropdown (admin only) - cleaner interface

### 3. Employee Utilization
- **Before:** Period controlled at top level
- **After:** Period dropdown moved into card header (top right)

### 4. PTO Usage
- **Before:** 
  - Bar chart
  - Rolling 12 months
  - No budgeting capability
- **After:**
  - Line chart (cumulative)
  - Calendar year only
  - Year selector in card header
  - Budget inputs for future months
  - Budgeted line shown on chart

### 5. Total Hours
- **Before:**
  - No user selection (always current user)
  - Data showing incorrectly (0 for Jan/Feb)
- **After:**
  - User dropdown for admins
  - Non-admins see only their data
  - Data fixed with proper numeric conversion
  - Shows individual vs 2,000hr target

## User Experience Flow

### For Admins:
1. Select Dashboard tab (default)
2. Use top-level dropdown to choose employee (affects all 3 charts)
3. Each chart has its own time period control
4. Can budget PTO for employees in future months
5. Can view any employee's total hours vs target

### For Employees:
1. See Dashboard tab (default)
2. No user dropdown - see only their own data
3. Each chart shows their personal metrics
4. Can budget their own PTO for future months
5. Track their own hours vs 2,000hr target

## Data Flow

```
User Selection (Top)
       ↓
   [All Charts Update]
       ↓
┌──────┴───────┬──────────────┐
│              │              │
Utilization    PTO Usage    Total Hours
[Period ▼]    [Year ▼]     [User ▼][Year ▼]
```
