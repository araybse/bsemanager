# Visual Verification Guide - API Costs Dashboard

## Quick Visual Checks

### ✅ Check 1: Current Time Display

**Expected Behavior:**
- Current time is ~11:42 AM EST
- "Updated at" badge should show: **"Updated 11:42 AM EST"**
- Live Activity Feed should show times like: **"11:35 AM", "11:28 AM"**, etc.

**If Broken (Before Fix):**
- Badge would show: "Updated 3:42 PM EST" ❌
- Activity feed would show: "3:35 PM", "3:28 PM" ❌

---

### ✅ Check 2: Hourly Breakdown Chart

**Expected Behavior:**
- X-axis should show EST hours: **"09:00", "10:00", "11:00"**
- Morning activity should appear in morning hours
- Chart line color should be **BLUE** (matches info/primary brand color)

**If Broken (Before Fix):**
- X-axis might show UTC hours (5 hours ahead)
- Chart line was purple/other color ❌

---

### ✅ Check 3: Agent Breakdown Pie Chart

**Expected Colors (in order):**
1. First agent (Max): **Blue** (#3b82f6)
2. Second agent (Sebastian): **Violet** (#8b5cf6)
3. Third agent (Olivia): **Pink** (#ec4899)
4. Fourth agent: **Amber** (#f59e0b)

**If Broken (Before Fix):**
- Random/inconsistent colors ❌
- Different colors than Project Detail Dashboard ❌

---

### ✅ Check 4: Model Breakdown Bar Chart

**Expected Behavior:**
- All bars should be **BLUE** (#3b82f6)
- Grid lines should be light gray
- Clean, consistent look

**If Broken (Before Fix):**
- Bars might be green/teal ❌
- Inconsistent with other dashboards ❌

---

### ✅ Check 5: Budget Progress Bar

**Expected Colors:**
| Spending | Color | Visual |
|----------|-------|--------|
| Under $150 | Green | ✅ On track |
| $150-$200 | Amber | ⚠️ Approaching limit |
| Over $200 | Red | 🚨 Over budget |

**Current Status:**
- Today's cost: $X.XX
- Bar should be appropriate color based on amount

---

### ✅ Check 6: Historical Tab - Monthly Overview

**Expected Behavior:**
- Bar chart with **BLUE** bars (#3b82f6)
- Shows all months from CSV import
- Consistent with real-time tab style

---

### ✅ Check 7: Compare to Project Detail Dashboard

**Open Both Dashboards:**
1. Navigate to any project → Dashboard tab
2. Open API Costs in another tab
3. Compare visually

**Should Match:**
- ✅ Chart colors (blue, violet, pink, etc.)
- ✅ Grid line color (light gray)
- ✅ Budget/progress bar behavior
- ✅ Overall visual "feel"

---

## Side-by-Side Color Comparison

### Primary Palette (Used Everywhere)
```
🟦 Blue    #3b82f6  (Most common - primary data)
🟪 Violet  #8b5cf6  (Second series)
🩷 Pink    #ec4899  (Third series)
🟨 Amber   #f59e0b  (Fourth series, warnings)
🟩 Green   #10b981  (Fifth series, positive states)
🔵 Cyan    #06b6d4  (Sixth series)
🟧 Orange  #f97316  (Seventh series)
🟩 Lime    #84cc16  (Eighth series)
```

### Semantic Colors (Special Meaning)
```
✅ Positive (Green): #10b981 - Under budget, profit
❌ Negative (Red):   #ef4444 - Over budget, loss
⚠️ Warning (Amber):  #f59e0b - Approaching limit
ℹ️ Info (Blue):      #3b82f6 - Primary data series
```

---

## Data Coverage Check

**Expected:**
- Real-time tab shows data from **today** (April 6, 2026)
- If you had morning sessions, they should appear
- If real-time tracking started at 11 AM, that's when data begins

**Check Database (for Austin):**
```sql
SELECT 
  created_at, 
  usage_date, 
  agent_name, 
  estimated_cost_usd 
FROM api_costs_realtime 
WHERE usage_date = '2026-04-06' 
ORDER BY created_at;
```

**Expected Result:**
- Rows with timestamps from when Olivia ran the script
- If Olivia ran it at 11 AM, first entry ~11:00 AM EST
- No earlier data unless there were actual sessions before 11 AM

---

## Timezone Troubleshooting

**If Times Still Look Wrong:**

1. Check browser timezone:
   ```javascript
   // In browser console
   Intl.DateTimeFormat().resolvedOptions().timeZone
   // Should show "America/New_York" or similar
   ```

2. Check server timezone:
   ```bash
   # On server
   timedatectl
   ```

3. Check database:
   ```sql
   SELECT NOW();  -- Should show current time in server timezone
   SELECT created_at FROM api_costs_realtime ORDER BY id DESC LIMIT 1;
   ```

**Common Issues:**
- Database timestamps stored without 'Z' suffix ✅ FIXED
- JavaScript misinterpreting UTC as local time ✅ FIXED
- Display code not converting to EST ✅ FIXED

---

## Quick Visual Checklist

Print this out and check off as you verify:

- [ ] Current time in "Updated at" badge is correct EST
- [ ] Live Activity Feed shows correct EST times
- [ ] Hourly breakdown shows EST hours (not 5 hours off)
- [ ] Hourly chart line is BLUE
- [ ] Agent pie chart uses primary palette (blue, violet, pink...)
- [ ] Model bar chart is BLUE
- [ ] Budget bar color matches spending level
- [ ] Historical tab charts are consistent with real-time tab
- [ ] Colors match Project Detail Dashboard
- [ ] No TypeScript or build errors

---

## Contact

If any issues remain, check:
- `CHANGELOG_API_COSTS_FIX.md` - Detailed technical changes
- `docs/DESIGN_SYSTEM.md` - Color usage guide
- `src/lib/charts/colors.ts` - Color palette definitions

**Last Updated:** April 6, 2026 11:42 AM EST  
**By:** Sophia (Subagent)
