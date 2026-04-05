# Type Definitions - Quick Reference

## Import Syntax

```ts
// Recommended: Import from barrel file
import { TimeEntry, ProjectWithRelations, UtilizationData } from '@/types'

// Alternative: Import from specific file
import { TimeEntry } from '@/types/time-entries'
```

## Common Use Cases

### 1. Time Entries

```ts
import { TimeEntry, TimeEntryWithRelations } from '@/types'

// Simple query
const entries: TimeEntry[] = await supabase
  .from('time_entries')
  .select('*')

// With relations
const entry: TimeEntryWithRelations = await supabase
  .from('time_entries')
  .select('*, projects(*), invoices(*), time_entry_bill_rates(*)')
  .eq('id', id)
  .single()
```

### 2. Dashboard API Responses

```ts
import { UtilizationApiResponse, MonthlyMultiplierData } from '@/types'

// Utilization
const { data } = await fetch('/api/dashboard/utilization')
const typed: UtilizationApiResponse = await data.json()

// Monthly Multipliers
const response = await fetch('/api/dashboard/monthly-multipliers')
const { monthlyMultipliers }: { monthlyMultipliers: MonthlyMultiplierData[] } 
  = await response.json()
```

### 3. Projects

```ts
import { Project, ProjectWithRelations, ProjectPhase } from '@/types'

// Simple project
const project: Project = await supabase
  .from('projects')
  .select('*')
  .eq('id', id)
  .single()

// With full details
const fullProject: ProjectWithRelations = await supabase
  .from('projects')
  .select(`
    *,
    clients(*),
    profiles(*),
    contract_phases(*),
    project_team_assignments(*)
  `)
  .eq('id', id)
  .single()

// Just phases
const phases: ProjectPhase[] = await supabase
  .from('contract_phases')
  .select('*')
  .eq('project_id', projectId)
```

### 4. React Query

```ts
import { TimeEntry, ProjectListItem } from '@/types'
import { useQuery } from '@tanstack/react-query'

// Time entries
const { data: entries } = useQuery({
  queryKey: ['time-entries'],
  queryFn: async (): Promise<TimeEntry[]> => {
    const { data } = await supabase.from('time_entries').select('*')
    return data || []
  }
})

// Project list
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: async (): Promise<ProjectListItem[]> => {
    // ... fetch logic
    return data
  }
})
```

### 5. Component Props

```ts
import { TimeEntry, ProjectPhase, UtilizationData } from '@/types'

interface TimeTableProps {
  entries: TimeEntry[]
  onSelect: (entry: TimeEntry) => void
}

interface PhaseChartProps {
  phases: ProjectPhase[]
  showBudget?: boolean
}

interface UtilizationChartProps {
  data: UtilizationData[]
  period: 'month' | 'quarter' | 'year'
}
```

### 6. API Route Handlers

```ts
import { NextResponse } from 'next/server'
import { MonthlyMultiplierData, UtilizationData } from '@/types'

export async function GET(request: Request) {
  // ... fetch data
  
  const result: MonthlyMultiplierData[] = months.map(month => ({
    month,
    monthLabel: formatMonth(month),
    revenue: revenueByMonth.get(month) || 0,
    cost: costByMonth.get(month) || 0,
    multiplier: calculateMultiplier(month)
  }))
  
  return NextResponse.json({ monthlyMultipliers: result })
}
```

### 7. Filters and Sorting

```ts
import { TimeEntryFilters, TimeEntrySortOptions, ProjectFilters } from '@/types'

const filters: TimeEntryFilters = {
  employee_id: 'user-123',
  project_number: 'BSE-2024-001',
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  is_billable: true
}

const sort: TimeEntrySortOptions = {
  field: 'entry_date',
  direction: 'desc'
}

const projectFilters: ProjectFilters = {
  status: ['active', 'on_hold'],
  pm_id: 'user-456',
  search: 'Highway'
}
```

## Type Categories

### Time Entries
- `TimeEntry` - Base type
- `TimeEntryWithProject` - With project info
- `TimeEntryWithRate` - With billing rate
- `TimeEntryWithRelations` - With all relations
- `TimeEntrySummary` - Aggregated data
- `TimeEntryFilters` - Query filters

### Dashboard
- `UtilizationData` - Utilization metrics
- `PTOUsageData` - PTO tracking
- `MonthlyMultiplierData` - Revenue/cost multipliers
- `DashboardSummaryMetrics` - Summary cards
- `MonthBreakdownDetails` - Detailed breakdown

### Projects
- `Project` - Base project
- `ProjectWithClient` - With client
- `ProjectWithRelations` - With all relations
- `ProjectPhase` - Contract phase
- `ProjectInvoice` - Invoice
- `ProjectFinancialSummary` - Financial metrics
- `ProjectPerformanceData` - Performance analytics

## Migration Patterns

### Before → After

**Untyped API response:**
```ts
// ❌ Before
const data: any = await fetch('/api/dashboard/utilization').then(r => r.json())

// ✅ After
const data: UtilizationApiResponse = await fetch('/api/dashboard/utilization')
  .then(r => r.json())
```

**Untyped Supabase query:**
```ts
// ❌ Before
const { data } = await supabase.from('time_entries').select('*')
const entries: any[] = data || []

// ✅ After
const { data } = await supabase.from('time_entries').select('*')
const entries: TimeEntry[] = data || []
```

**Untyped component props:**
```ts
// ❌ Before
interface ChartProps {
  data: any[]
}

// ✅ After
interface ChartProps {
  data: UtilizationData[]
}
```

## Tips

1. **Start with base types** (`TimeEntry`, `Project`) and add relations as needed
2. **Use specific types** over generic - prefer `TimeEntryWithRate` over `any`
3. **Type API responses** immediately - catches errors early
4. **Import from `@/types`** for cleaner code
5. **Check the README** for detailed examples

## Need Help?

- See `/src/types/README.md` for detailed documentation
- Check individual files for JSDoc comments
- Look at existing usage in components for examples
