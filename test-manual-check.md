# BSE Manager Manual Test Checklist

## Deployment Status
✅ Code pushed to GitHub (commit f7e2427)
✅ Vercel deployment active (https://bsemanager.vercel.app)
✅ Login page loads correctly
✅ Auth middleware present and configured

## Manual Browser Tests Needed

### 1. Authentication Flow
- [ ] Visit https://bsemanager.vercel.app/
- [ ] Redirects to /login automatically
- [ ] Login form displays correctly
- [ ] Try invalid credentials → should show error
- [ ] Login with valid admin credentials → redirects to /dashboard

### 2. Admin Dashboard (Austin - admin role)
- [ ] /dashboard loads without errors
- [ ] Shows admin-specific cards (all project metrics)
- [ ] No console errors in browser DevTools
- [ ] Can navigate to all sidebar pages

### 3. PM Dashboard (Wesley Koning - project_manager role)
- [ ] Login as Wesley
- [ ] /dashboard shows PM-specific view
- [ ] "My Projects" card displays Wesley's assigned projects
- [ ] "Monthly Performance" chart loads with data (or skeleton if no data)
- [ ] Cannot access admin-only pages (/accounting, /cash-flow, etc.)
- [ ] Can access /projects (filtered to assigned projects only)

### 4. Employee View (Arber - employee role)
- [ ] Login as Arber
- [ ] Automatically redirects from /dashboard to /timesheet
- [ ] /timesheet page loads without errors
- [ ] Can access /projects (filtered to assigned projects only)
- [ ] Cannot access /dashboard, /contracts, /invoices, etc.
- [ ] Sidebar only shows: Projects, Timesheet, Settings

### 5. Data Accuracy
- [ ] Admin: Project counts match QuickBooks
- [ ] PM: "My Projects" shows correct assignments
- [ ] Employee: Only sees their assigned projects
- [ ] No rate/billing information visible to employees

## Known Issues to Watch For
- Performance chart placeholder multiplier (0.85) - should be replaced with actual calculation
- Ensure no TypeScript errors in browser console
- Check that all images/logos load properly

## Next Steps After Manual Testing
1. If any issues found → debug and iterate
2. If all tests pass → Mark #36 complete in GitHub
3. Update MEMORY.md with Phase 1 completion status
4. Move to next Phase 1 task
