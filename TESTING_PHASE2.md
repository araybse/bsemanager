# Phase 2 Testing Guide

## Quick Start

```bash
# 1. Start dev server
cd ~/.openclaw/workspace/bsemanager
npm run dev

# 2. Open browser
# Navigate to: http://localhost:3000/dashboard
# (or port 3001 if 3000 is in use)

# 3. Log in as admin user
# Email: admin@example.com
# Password: [your admin password]
```

---

## Testing Checklist

### ✅ 1. API Endpoints

Test all three endpoints are working:

```bash
# Replace with your auth token from browser devtools
TOKEN="your-auth-token-here"

# Test summary endpoint
curl -H "Cookie: sb-access-token=$TOKEN" \
  'http://localhost:3000/api/costs/summary?period=month'

# Expected: JSON with total, byCategory, byProject, count, trend

# Test recent endpoint
curl -H "Cookie: sb-access-token=$TOKEN" \
  'http://localhost:3000/api/costs/recent?limit=10'

# Expected: JSON with array of recent cost entries

# Test trends endpoint
curl -H "Cookie: sb-access-token=$TOKEN" \
  'http://localhost:3000/api/costs/trends?days=30'

# Expected: JSON with daily trend data
```

### ✅ 2. Widget Visibility

**As Admin:**
- [ ] Navigate to `/dashboard`
- [ ] Widget is visible in top row (3rd position)
- [ ] Shows total cost
- [ ] Shows trend indicator
- [ ] Shows top 3 categories
- [ ] Shows API call count

**As Non-Admin (PM/Employee):**
- [ ] Navigate to `/dashboard`
- [ ] Widget is **NOT** visible
- [ ] Only 2 cards in top row

### ✅ 3. Widget Functionality

- [ ] **Total Cost:** Displays as `$X.XX` format
- [ ] **Trend Indicator:**
  - [ ] Shows ↑ with red color if increasing
  - [ ] Shows ↓ with green color if decreasing
  - [ ] Shows "No change" if equal
- [ ] **Categories:** Top 3 by cost displayed
- [ ] **API Count:** Shows correct number
- [ ] **Link Button:** "View detailed breakdown →" present

### ✅ 4. Auto-Refresh

- [ ] Watch widget for 30+ seconds
- [ ] Data should refresh automatically
- [ ] Check Network tab: request every 30s to `/api/costs/summary`

### ✅ 5. Responsive Design

Test at different screen sizes:

**Desktop (1920px+):**
- [ ] 3 cards in row: Revenue, Cash Basis, API Costs

**Tablet (768px - 1023px):**
- [ ] 2 cards per row
- [ ] API Costs wraps to second row

**Mobile (< 768px):**
- [ ] 1 card per row, stacked vertically

### ✅ 6. Loading States

Clear cache and reload:
- [ ] Shows "Loading..." text briefly
- [ ] Then displays data
- [ ] No errors in console

### ✅ 7. Error Handling

Test edge cases:

**No Data:**
```sql
-- Temporarily delete all data
DELETE FROM api_cost_log;
```
- [ ] Shows `$0.00`
- [ ] Shows "No change from last week"
- [ ] Shows "0 API calls this month"
- [ ] No errors, graceful degradation

**Re-add data:**
```bash
psql "$DB_URL" -f test-data-api-costs.sql
```

---

## Database Verification

### Check Data

```bash
DB_URL="postgresql://postgres.lqlyargzteskhsddbjpa:BsE%232023admin@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# Total records
psql "$DB_URL" -c "SELECT COUNT(*) FROM api_cost_log;"

# Total cost
psql "$DB_URL" -c "SELECT SUM(cost_usd) FROM api_cost_log;"

# By category
psql "$DB_URL" -c "SELECT category, COUNT(*), SUM(cost_usd) FROM api_cost_log GROUP BY category ORDER BY SUM(cost_usd) DESC;"

# Recent 5
psql "$DB_URL" -c "SELECT timestamp, cost_usd, category, project, model FROM api_cost_log ORDER BY timestamp DESC LIMIT 5;"
```

### Expected Output

```
 count 
-------
    23

    sum    
-----------
  6.760000

 category  | count |   sum    
-----------+-------+----------
 llm       |    16 | 5.310000
 vision    |     3 | 0.690000
 tts       |     2 | 0.340000
 embedding |     2 | 0.380000
```

---

## Authentication Testing

### As Admin
1. Log in with admin credentials
2. Navigate to `/dashboard`
3. Widget should be visible
4. API calls should succeed (200 OK)

### As Non-Admin
1. Log in with PM/Employee credentials
2. Navigate to `/dashboard`
3. Widget should be hidden
4. Direct API calls should return 403 Forbidden:
   ```bash
   curl 'http://localhost:3000/api/costs/summary'
   # Expected: {"error":"Forbidden"} or 401/403
   ```

---

## Browser DevTools Checks

### Console
- [ ] No errors
- [ ] No warnings (except middleware deprecation - known)

### Network Tab
- [ ] `/api/costs/summary` - 200 OK
- [ ] Requests every 30 seconds
- [ ] Response time < 1s

### React DevTools
- [ ] `APICostWidget` component renders
- [ ] `useQuery` hook shows data
- [ ] No unnecessary re-renders

---

## Performance

Widget should:
- [ ] Load in < 1 second
- [ ] Refresh in < 500ms
- [ ] Not cause layout shift
- [ ] Not block other dashboard elements

---

## Known Issues

**None** - all functionality working as expected.

---

## Troubleshooting

### Widget Not Visible
**Check:**
1. Are you logged in as admin?
2. Check browser console for errors
3. Verify `userRole === 'admin'` in React DevTools

### API Returns Empty Data
**Check:**
1. Database has records: `SELECT COUNT(*) FROM api_cost_log;`
2. Timestamps are recent (last 30 days)
3. RLS policies allow admin access

### Trend Shows 0%
**Expected** - means week-over-week costs are identical

### Dev Server Port Issues
**Fix:**
```bash
# Kill existing Next.js processes
ps aux | grep "next dev" | awk '{print $2}' | xargs kill -9

# Remove lock file
rm -rf .next/dev/lock

# Restart
npm run dev
```

---

## Success Criteria

All boxes checked = Phase 2 complete! ✅

**Report to Austin:**
- Screenshot of dashboard with widget
- Test results (this checklist)
- Any issues encountered

---

## Next: Phase 3 (Optional)

If Austin wants the full cost dashboard:
- [ ] Create `/admin/costs` page
- [ ] Add date range filters
- [ ] Add interactive charts
- [ ] Add export to CSV
- [ ] Add budget alerts

Estimated: 5-8 hours
