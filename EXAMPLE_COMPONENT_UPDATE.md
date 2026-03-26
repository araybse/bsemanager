# Example Component Update: Projects Page

This document shows how to update an existing component to use the new role-based permissions system.

## Before: Projects Page (Current)

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
// ... other imports

export default function ProjectsPage() {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  
  // No role/permission checks - shows all UI elements
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('project_number', { ascending: false })
      if (error) throw error
      return data
    },
  })

  return (
    <div>
      {/* Create Project button always visible */}
      <Button>
        <Plus className="h-4 w-4" />
        Create Project
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            {/* Action and Archive columns always visible */}
            <TableHead>Actions</TableHead>
            <TableHead>Archive</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* List all projects */}
          {projects?.map(project => (
            <TableRow key={project.id}>
              {/* ... */}
              <TableCell>{/* Actions */}</TableCell>
              <TableCell>{/* Archive */}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

## After: Updated Projects Page

```typescript
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/auth/use-permissions'
import { useProjectVisibility } from '@/lib/auth/use-project-visibility'
// ... other imports

export default function ProjectsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  // NEW: Permission checks
  const perms = usePermissions()
  const projVis = useProjectVisibility()
  
  const [searchQuery, setSearchQuery] = useState('')
  
  // UPDATED: Query is now filtered by RLS at database level
  // Additional client-side filtering for UX
  const { data: allProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('project_number', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // NEW: Filter projects for current user's role
  const projects = useMemo(() => {
    if (!allProjects) return []
    return projVis.filterProjectsForRole(allProjects)
  }, [allProjects, projVis])

  // NEW: Check if user can create projects
  const canCreate = projVis.canCreateProject

  return (
    <div>
      {/* UPDATED: Create Project button only for admins */}
      {canCreate && (
        <Button onClick={handleCreateProject}>
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      )}

      {/* NEW: Show message if PM with no projects */}
      {!canCreate && projects.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No projects assigned. Contact your administrator to be added to a project.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        // Loading skeleton
        <ProjectsTableSkeleton />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              
              {/* UPDATED: Admin-only columns */}
              {perms.isAdmin() && (
                <>
                  <TableHead>Actions</TableHead>
                  <TableHead>Archive</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* List filtered projects */}
            {projects?.map(project => (
              <TableRow key={project.id}>
                <TableCell>
                  <Link href={`/projects/${project.id}`}>
                    {project.project_number}
                  </Link>
                </TableCell>
                <TableCell>{project.name}</TableCell>
                <TableCell>{project.clients?.name || '-'}</TableCell>
                
                {/* UPDATED: Show actions/archive only for admin */}
                {perms.isAdmin() && (
                  <>
                    <TableCell>
                      {/* Actions dropdown */}
                      <ProjectActionsMenu project={project} />
                    </TableCell>
                    <TableCell>
                      {/* Archive checkbox */}
                      <ArchiveCheckbox project={project} />
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

---

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Permission check** | None | `usePermissions()` + `useProjectVisibility()` |
| **Create button** | Always visible | Conditional: `{canCreate && <Button>}` |
| **Project list** | All projects | Filtered by `filterProjectsForRole()` |
| **Action/Archive columns** | Always visible | Conditional: `{perms.isAdmin() && <TableHead>}` |
| **RLS** | Applied at DB | Applied at DB (frontend aware) |
| **Fallback UI** | None | Message when PM has no projects |

---

## Another Example: Dashboard Widgets

```typescript
'use client'

import { usePermissions } from '@/lib/auth/use-permissions'
import {
  MyProjectsCard,
  MonthlyPerformanceChart,
  ProjectsReadyToBuild,
  RevenueTrendChart,
  CashBasisChart,
} from '@/components/dashboard'

export default function DashboardPage() {
  const perms = usePermissions()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* NEW: Conditional rendering using permission checks */}
      
      {/* Only for Project Managers */}
      {perms.canSeeDashboardWidget('my-projects') && (
        <MyProjectsCard />
      )}

      {/* For PM and Admin */}
      {perms.canSeeDashboardWidget('monthly-performance') && (
        <MonthlyPerformanceChart />
      )}

      {/* Admin only */}
      {perms.canSeeDashboardWidget('projects-ready-to-build') && (
        <ProjectsReadyToBuild />
      )}

      {perms.canSeeDashboardWidget('revenue-trend') && (
        <RevenueTrendChart />
      )}

      {perms.canSeeDashboardWidget('cash-basis-profit-expenses') && (
        <CashBasisChart />
      )}
    </div>
  )
}
```

---

## Table with Hidden Columns: Labor Tab

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/lib/auth/use-permissions'
import { IfFieldVisible } from '@/lib/auth/use-permissions'

interface LaborEntry {
  id: number
  date: string
  employee_name: string
  hours: number
  amount: number
  notes?: string
}

export function LaborTable({ entries }: { entries: LaborEntry[] }) {
  const perms = usePermissions()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Hours</TableHead>
          
          {/* NEW: Hide Amount column for PM/Employee */}
          <IfFieldVisible fieldPath="labor.amount">
            <TableHead className="text-right">Amount</TableHead>
          </IfFieldVisible>
          
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(entry => (
          <TableRow key={entry.id}>
            <TableCell>{entry.date}</TableCell>
            <TableCell>{entry.employee_name}</TableCell>
            <TableCell>{entry.hours.toFixed(2)}</TableCell>
            
            {/* NEW: Hide Amount cell for PM/Employee */}
            <IfFieldVisible fieldPath="labor.amount">
              <TableCell className="text-right">
                ${entry.amount.toFixed(2)}
              </TableCell>
            </IfFieldVisible>
            
            <TableCell>{entry.notes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

## Pattern: Conditional Tab Navigation

```typescript
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermissions } from '@/lib/auth/use-permissions'

export function ProjectTabs({ projectId }: { projectId: number }) {
  const perms = usePermissions()

  // Define all available tabs
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'project-info', label: 'Project Info' },
    { id: 'team', label: 'Team' },
    { id: 'agencies-permits', label: 'Agencies & Permits' },
    { id: 'applications', label: 'Applications' },
    { id: 'phases', label: 'Phases' },
    { id: 'billables', label: 'Billables' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'labor', label: 'Labor' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'contracts', label: 'Contracts' },
  ]

  // Filter to only visible tabs for this role
  const visibleTabs = tabs.filter(
    tab => perms.canSeeProjectTab(tab.id)
  )

  // Redirect if current tab not visible
  const currentTab = useCurrentTab()
  useEffect(() => {
    if (!visibleTabs.find(t => t.id === currentTab)) {
      // Redirect to first visible tab
      setCurrentTab(visibleTabs[0]?.id || 'dashboard')
    }
  }, [currentTab, visibleTabs])

  return (
    <Tabs value={currentTab} onValueChange={setCurrentTab}>
      <TabsList>
        {visibleTabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="dashboard">
        <ProjectDashboard projectId={projectId} />
      </TabsContent>

      {perms.canSeeProjectTab('team') && (
        <TabsContent value="team">
          <ProjectTeam projectId={projectId} />
        </TabsContent>
      )}

      {/* ... other tabs ... */}
    </Tabs>
  )
}
```

---

## Common Patterns

### 1. **Admin Check**
```typescript
{perms.isAdmin() && <AdminFeature />}
```

### 2. **Cost Data (PM/Admin)**
```typescript
{perms.canSeeCostData() && <CostTable />}
```

### 3. **Team Management**
```typescript
{perms.canManageTeam() && <TeamMember />}
```

### 4. **Field Visibility**
```typescript
<IfFieldVisible fieldPath="labor.amount">
  <AmountCell value={amount} />
</IfFieldVisible>
```

### 5. **Page Navigation**
```typescript
{perms.canSeePage('dashboard') && (
  <NavLink href="/dashboard">Dashboard</NavLink>
)}
```

---

## Testing Your Changes

```typescript
// In your test file:
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '@/components/providers/auth-provider'
import ProjectsPage from './projects/page'

// Mock auth context
jest.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    role: 'project_manager',
    assignedProjectIds: [1, 2],
  }),
}))

test('PM sees create button hidden', () => {
  render(
    <AuthProvider>
      <ProjectsPage />
    </AuthProvider>
  )
  
  expect(screen.queryByText('Create Project')).not.toBeInTheDocument()
})

test('Admin sees create button', () => {
  // Change mock to admin role
  expect(screen.getByText('Create Project')).toBeInTheDocument()
})
```

---

## Rollout Checklist

- [ ] Update Projects list page
- [ ] Update Projects detail page (tabs)
- [ ] Update Dashboard page (widgets)
- [ ] Update Labor tab (hide Amount column)
- [ ] Update Settings page (hide admin sections)
- [ ] Update Billables Report page
- [ ] Update Timesheet page (if new)
- [ ] Test each role (admin, PM, employee)
- [ ] Verify RLS policies working
- [ ] Check for console errors
- [ ] Performance test with large project lists
