# Role-Based Visibility Permissions Implementation (#36)

**Status:** Phase 1 Complete - Backend & Utilities Ready  
**Date:** March 26, 2026  
**Approved By:** Austin Ray

---

## ✅ What Has Been Implemented

### 1. **Permissions Module** (`src/lib/auth/permissions.ts`)
Comprehensive visibility rules for all roles:

**Page Visibility Rules:**
- Admin: All pages visible
- Project Manager: Dashboard, Projects, Timesheet, Billables Report
- Employee: Dashboard, Timesheet
- Client: None (restricted)

**Project Tab Visibility:**
- Admin: All tabs
- Project Manager: Dashboard, Project Info, Team, Agencies, Applications, Phases, Billables, Invoices, Labor, Expenses, Contracts
- Employee: Dashboard, Project Info, Agencies, Applications

**Settings Section Visibility:**
- Admin: Users, Sync, Schedule of Rates, Clients, Project Info, Agencies
- Project Manager: Project Info, Agencies
- Employee: Project Info, Agencies

**Hidden Fields Per Role:**
- PM: Labor.amount, QB settings, API keys, Sync controls
- Employee: All cost data (labor.amount, labor.cost, billables.rate, billables.cost), QB/API/Sync settings

**Helper Functions:**
```typescript
canSeePage(page, role)
canSeeProjectTab(tab, role)
canSeeSettingsSection(section, role)
canSeeDashboardWidget(widget, role)
canSeeTimesheetFeature(feature, role)
isFieldHidden(fieldPath, role)
canCreateProject(role)
canSeeFullProjectList(role)
canManageTeam(role)
canSeeCostData(role)
isAdmin(role)
```

### 2. **Enhanced Auth Context** (`src/components/providers/auth-provider.tsx`)
Added `assignedProjectIds: number[]` to auth context:

```typescript
interface AuthContextType {
  user: User | null
  profile: Tables<'profiles'> | null
  role: UserRole | null
  assignedProjectIds: number[] // NEW: Projects where user is PM or team member
  isLoading: boolean
  isReady: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}
```

**Behavior:**
- Admin: `assignedProjectIds` is empty (admin sees all via RLS)
- PM: Contains projects where they're PM + team assignments
- Employee: Contains only projects they're assigned to

### 3. **API Route Enhancement** (`src/app/api/auth/me/route.ts`)
Fetches assigned projects on login:

```typescript
// Returns:
{
  user: { id: string; email: string }
  profile: Tables<'profiles'>
  assignedProjectIds: number[] // New field
}
```

**Query Logic:**
```sql
-- Project Manager (PM) role projects:
SELECT id FROM projects WHERE pm_id = user.id

UNION

-- Team assignments:
SELECT project_id FROM project_team_assignments WHERE user_id = user.id
```

### 4. **Permission Hooks** (`src/lib/auth/use-permissions.ts`)
Client-side permission checking:

```typescript
const perms = usePermissions()

// Page visibility
if (perms.canSeePage('dashboard')) { ... }

// Field visibility
if (perms.isFieldHidden('labor.amount')) { ... }

// Role checks
if (perms.isAdmin()) { ... }
if (perms.isProjectManagerOrAdmin()) { ... }

// Lists
const visiblePages = perms.getVisiblePages()
const visibleTabs = perms.getVisibleProjectTabs()
```

**Conditional Rendering Components:**
```tsx
<IfCanSee page="dashboard">
  <Dashboard />
</IfCanSee>

<IfRole role="admin">
  <AdminPanel />
</IfRole>

<IfFieldVisible fieldPath="labor.amount">
  <AmountColumn />
</IfFieldVisible>
```

### 5. **Project Visibility Hook** (`src/lib/auth/use-project-visibility.ts`)
Filter projects based on user role:

```typescript
const { canViewProject, filterProjectsForRole } = useProjectVisibility()

// Check if user can view specific project
if (canViewProject(projectId)) { ... }

// Filter project list
const userProjects = filterProjectsForRole(allProjects)
```

### 6. **Navigation Update** (`src/components/layout/sidebar.tsx`)
Updated sidebar to use permissions-based visibility:

```typescript
// Before: Hard-coded roles in nav items
// After: Uses PAGE_VISIBILITY from permissions module

const filteredNavItems = navItems.filter((item) => {
  const visibility = PAGE_VISIBILITY[item.pageKey]?.[role]
  return visibility === 'visible'
})
```

### 7. **Database RLS Policies** (Migration: `20260326_role_based_visibility_permissions.sql`)

**All 25 Tables Protected:**

1. **profiles** - See own + team members on shared projects
2. **projects** - See assigned projects only
3. **project_info** - See assigned projects
4. **contract_phases** - See assigned projects
5. **project_submittals** - See assigned projects (Agencies)
6. **project_permits** - See assigned projects (Permits)
7. **billable_rates** - PM/Admin only (prevents salary visibility)
8. **time_entries** - Own entries + PM team oversight
9. **reimbursables** - PM/Admin only
10. **invoices** - PM/Admin only
11. **invoice_line_items** - Via invoice access
12. **rate_positions** - Active public read (lookup table)
13. **rate_schedules** - Active public read (lookup table)
14. **rate_schedule_items** - Active public read (lookup table)
15. **project_rate_schedule_assignments** - PM/Admin only
16. **project_rate_position_overrides** - PM/Admin only
17. **clients** - See clients on assigned projects
18. **proposals** - Admin only
19. **proposal_phases** - Admin only
20. **contract_labor** - Admin only
21. **qbo_income** - Admin only
22. **cash_flow_entries** - Admin only
23. **memberships** - Admin only
24. **membership_schedule** - Admin only
25. **project_team_assignments** - Already configured

**Helper Function:**
```sql
CREATE FUNCTION public.get_user_assigned_projects(user_id UUID)
-- Returns all project IDs where user is PM or team member
-- Used by RLS policies for efficient filtering
```

---

## 🔧 Testing the Implementation

### Manual Testing Checklist

#### 1. **Admin Login**
```
User: admin@example.com (role: admin)
Expected: 
- All pages visible in sidebar
- All projects visible in projects list
- Can create projects
- Can see all tabs on project detail
- Can see all fields (including labor amount)
- Dashboard shows all widgets
```

#### 2. **Project Manager Login**
```
User: pm@example.com (role: project_manager)
Expected:
- Dashboard, Projects, Timesheet, Billables visible
- Projects list shows only: projects where PM + assigned teams
- Cannot create new projects
- Labor tab shows but "Amount" column hidden
- Cannot see: Invoices, Accounting, Cash Flow, Contract Labor, Settings
- Can see team members on their projects
```

#### 3. **Employee Login**
```
User: employee@example.com (role: employee)
Expected:
- Only Dashboard, Timesheet visible
- Projects page NOT visible
- Can view own timesheet
- Can edit own time entries
- Cannot see cost data (billables rate, labor cost)
- Cannot see admin-only pages
- Labor tab hidden
- Cannot see team tab
```

### API Testing

#### Test Auth Endpoint
```bash
# As Project Manager
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/me

# Expected response:
{
  "user": { "id": "...", "email": "pm@example.com" },
  "profile": { "id": "...", "role": "project_manager", ... },
  "assignedProjectIds": [1, 5, 7]  # PM's assigned projects
}
```

#### Test Projects Query
```typescript
// Should only return assigned projects due to RLS
const { data } = await supabase
  .from('projects')
  .select('*')
// Result: Only projects user is PM or team member on
```

---

## 📋 Frontend Components Still Needing Updates

### High Priority (User-Facing)

1. **Projects List Page** (`src/app/(authenticated)/projects/page.tsx`)
   - [x] Already filters via RLS at database level
   - [ ] Update UI to use `useProjectVisibility()` for client-side checks
   - [ ] Hide "Create Project" button for non-admins
   - [ ] Hide "Action" and "Archive" columns for PMs

   ```typescript
   import { useProjectVisibility } from '@/lib/auth/use-project-visibility'
   
   export default function ProjectsPage() {
     const { canCreateProject, filterProjectsForRole } = useProjectVisibility()
     
     // In JSX:
     {canCreateProject && <Button>+ New Project</Button>}
     
     // Filter columns
     {isAdmin && <TableHead>Actions</TableHead>}
     {isAdmin && <TableHead>Archive</TableHead>}
   }
   ```

2. **Dashboard Page** (`src/app/(authenticated)/dashboard/page.tsx`)
   - [ ] Use `usePermissions()` to conditionally render widgets
   - [ ] Show "My Projects" card only for PM
   - [ ] Hide financial widgets from non-admin users

   ```typescript
   import { usePermissions } from '@/lib/auth/use-permissions'
   
   export default function DashboardPage() {
     const perms = usePermissions()
     
     // Conditionally render widgets:
     {perms.canSeeDashboardWidget('my-projects') && <MyProjectsCard />}
     {perms.canSeeDashboardWidget('revenue-trend') && <RevenueTrendChart />}
     {perms.canSeeDashboardWidget('cash-basis-profit-expenses') && <CashBasisChart />}
   }
   ```

3. **Project Detail Page** (`src/app/(authenticated)/projects/[id]/page.tsx`)
   - [ ] Use `usePermissions()` to hide/show tabs
   - [ ] Hide tabs based on role
   - [ ] Hide sensitive fields in tables

   ```typescript
   import { usePermissions } from '@/lib/auth/use-permissions'
   
   const tabs = [
     { id: 'dashboard', label: 'Dashboard', visible: perms.canSeeProjectTab('dashboard') },
     { id: 'team', label: 'Team', visible: perms.canSeeProjectTab('team') },
     { id: 'labor', label: 'Labor', visible: perms.canSeeProjectTab('labor') },
   ].filter(t => t.visible)
   ```

4. **Labor Tab** (Inside Project Detail)
   - [ ] Hide "Amount" column for PM/Employee
   - [ ] Show cost data only to admin/PM

   ```typescript
   <IfFieldVisible fieldPath="labor.amount">
     <TableHead>Amount</TableHead>
   </IfFieldVisible>
   ```

5. **Settings Page** (`src/app/(authenticated)/settings/page.tsx`)
   - [ ] Use `usePermissions()` to filter tabs
   - [ ] Only show "Project Info" and "Agencies & Permits" to non-admin

   ```typescript
   {perms.canSeeSettingsSection('users') && <UsersTab />}
   {perms.canSeeSettingsSection('sync') && <SyncTab />}
   {perms.canSeeSettingsSection('project-info') && <ProjectInfoTab />}
   ```

6. **Timesheet Page** (New or existing `/timesheet`)
   - [ ] Implement if not exists
   - [ ] PM/Employee: Show only own timesheet
   - [ ] Admin: Show employee dropdown + any timesheet
   - [ ] Use `canSeeTimesheetFeature()` for feature visibility

### Medium Priority

7. **Billables Report Page** (`src/app/(authenticated)/unbilled/page.tsx`)
   - [ ] Filter to show only assigned projects for PM
   - [ ] Hide from Employee

8. **Time Entries Legacy Page** (`src/app/(authenticated)/time-entries/page.tsx`)
   - [ ] Hide from non-admin (with deprecation notice)
   - [ ] Recommend Timesheet page

### Low Priority (Admin-Only)

9. **Invoices Page** - Already admin-only via sidebar
10. **Accounting Pages** - Already admin-only via sidebar
11. **Cash Flow Page** - Already admin-only via sidebar
12. **Contract Labor Page** - Already admin-only via sidebar

---

## 🚀 Usage Examples

### In a Component

```typescript
'use client'

import { usePermissions } from '@/lib/auth/use-permissions'
import { useProjectVisibility } from '@/lib/auth/use-project-visibility'
import { IfCanSee, IfRole, IfFieldVisible } from '@/lib/auth/use-permissions'

export function MyComponent() {
  const perms = usePermissions()
  const projVis = useProjectVisibility()

  return (
    <>
      {/* Show content based on page visibility */}
      <IfCanSee page="dashboard">
        <Dashboard />
      </IfCanSee>

      {/* Show content based on role */}
      <IfRole role="admin">
        <AdminPanel />
      </IfRole>

      {/* Show content based on field visibility */}
      <IfFieldVisible fieldPath="labor.amount">
        <AmountColumn />
      </IfFieldVisible>

      {/* Conditional button based on permissions */}
      {perms.isAdmin() && (
        <Button onClick={deleteProject}>Delete Project</Button>
      )}

      {/* Filter lists */}
      {projVis.canCreateProject && (
        <Button>+ New Project</Button>
      )}
    </>
  )
}
```

### Middleware Path Protection

The existing middleware continues to protect routes:
- Unauthenticated users → redirect to `/login`
- Austin Burke special case → limited to `/projects` and `/settings`

Database-level RLS provides additional protection so queries return only allowed data.

---

## 🗂️ File Structure

```
src/
├── lib/auth/
│   ├── api-authorization.ts (existing, unchanged)
│   ├── permissions.ts (NEW) - Visibility rules
│   ├── use-permissions.ts (NEW) - React hook + components
│   └── use-project-visibility.ts (NEW) - Project filtering
├── components/providers/
│   └── auth-provider.tsx (UPDATED) - Added assignedProjectIds
├── components/layout/
│   └── sidebar.tsx (UPDATED) - Uses permissions module
├── app/api/auth/
│   └── me/route.ts (UPDATED) - Fetches assigned projects
└── app/(authenticated)/
    ├── dashboard/page.tsx (TO UPDATE)
    ├── projects/page.tsx (TO UPDATE)
    ├── projects/[id]/page.tsx (TO UPDATE)
    └── settings/page.tsx (TO UPDATE)

supabase/
└── migrations/
    └── 20260326_role_based_visibility_permissions.sql (NEW)
```

---

## ⚠️ Important Notes

### RLS Security

**Database-level RLS is the PRIMARY security mechanism:**
- All table queries are filtered by RLS policies
- Frontend visibility checks are SECONDARY (UX enhancement)
- Even if frontend "shows all", RLS prevents unauthorized data access
- Admin cannot override RLS (it applies to all roles)

**Testing RLS:**
```sql
-- As a PM user:
SELECT * FROM projects
-- Returns: Only PM's projects + team projects (enforced by RLS)

-- As admin:
SELECT * FROM projects
-- Returns: All projects (admin has full access)
```

### Backward Compatibility

- Auth context changes are backward compatible
- `assignedProjectIds` is optional (empty for admin)
- Existing components without permission checks still work
- RLS is additive (doesn't break existing queries)

### Performance Considerations

- `get_user_assigned_projects()` uses UNION (efficient)
- RLS policies use indexed lookups
- Caching: Auth context caches results
- Consider pagination for large project lists

---

## 📝 Next Steps

1. **Apply Migration**
   ```bash
   supabase migration up
   ```

2. **Test RLS Policies**
   - Log in as each role
   - Verify query results match expected visibility
   - Check browser network tab for data

3. **Update Components** (Use checklist above)
   - Start with high-priority components
   - Test after each update
   - Use `IfCanSee`, `IfRole`, `IfFieldVisible` for consistency

4. **Integration Testing**
   - Test full user flows per role
   - Verify hidden fields aren't accessible via API
   - Test edge cases (user removed from project, role changed, etc.)

5. **Deploy**
   - Create release notes mentioning new permissions
   - Communicate role-based visibility to users
   - Monitor for RLS-related errors

---

## 🔍 Troubleshooting

### 401 Error on Projects Query
- Check RLS policies are enabled on all tables
- Verify `auth.uid()` is set in session
- Check project_team_assignments records exist

### Projects Not Visible
- Verify user is set as `pm_id` in projects table OR
- Verify project_team_assignments record exists
- Check RLS policy is returning data

### Timesheet Issues
- Verify employee_id in time_entries matches auth.uid()
- Check RLS policy for time_entries table

### Performance Issues
- Check that `get_user_assigned_projects()` function exists
- Verify indexes on `projects.pm_id` and `project_team_assignments(user_id)`
- Consider caching results if many projects

---

## 📞 Questions?

See the Permissions Matrix at `/BSEMANAGER_PERMISSIONS_MATRIX.md` for the source of truth on visibility rules.

---

**Implementation Status:** ✅ Backend Complete | 🔄 Frontend In Progress | ⏳ Testing Ready
