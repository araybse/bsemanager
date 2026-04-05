# Type Definitions

This directory contains TypeScript type definitions to replace `any` types throughout the application.

## Files

### `time-entries.ts`
Type definitions for the `time_entries` table and related data structures.

**Key Types:**
- `TimeEntry` - Base time entry from database
- `TimeEntryWithRelations` - Time entry with project, invoice, and rate information
- `TimeEntryWithRate` - Time entry with billing rate details
- `TimeEntrySummary` - Aggregated summary data for reports
- `TimeEntryFilters` - Filter options for querying

**Usage Example:**
```ts
import { TimeEntry, TimeEntryWithRelations } from '@/types'

// Basic time entry
const entry: TimeEntry = await supabase
  .from('time_entries')
  .select('*')
  .eq('id', 123)
  .single()

// Time entry with relations
const entryWithDetails: TimeEntryWithRelations = await supabase
  .from('time_entries')
  .select(`
    *,
    projects(*),
    invoices(*),
    time_entry_bill_rates(*)
  `)
  .eq('id', 123)
  .single()
```

### `dashboard.ts`
Type definitions for dashboard components and API responses.

**Key Types:**
- `UtilizationData` - Employee utilization by period
- `PTOUsageData` - PTO/vacation usage by period
- `MonthlyMultiplierData` - Monthly revenue/cost multipliers
- `DashboardSummaryMetrics` - 4-card summary metrics
- `MonthBreakdownDetails` - Detailed monthly breakdown

**Usage Example:**
```ts
import { MonthlyMultiplierData, UtilizationData } from '@/types'

// API response typing
const { data } = useQuery({
  queryKey: ['monthly-multipliers'],
  queryFn: async () => {
    const response = await fetch('/api/dashboard/monthly-multipliers')
    const result = await response.json()
    return result.monthlyMultipliers as MonthlyMultiplierData[]
  }
})

// Chart data typing
const utilizationChart: UtilizationData[] = [
  {
    period: '2024-03',
    periodLabel: 'Mar 2024',
    totalHours: 160,
    projectHours: 140,
    utilizationRate: 87.5
  }
]
```

### `project.ts`
Type definitions for projects, phases, invoices, and related entities.

**Key Types:**
- `Project` - Base project from database
- `ProjectWithRelations` - Project with client, PM, phases, team
- `ProjectPhase` - Contract phase information
- `ProjectInvoice` - Invoice data
- `ProjectFinancialSummary` - Financial metrics and calculations
- `ProjectPerformanceData` - Performance analytics

**Usage Example:**
```ts
import { ProjectWithRelations, ProjectPhase } from '@/types'

// Project with full details
const project: ProjectWithRelations = await supabase
  .from('projects')
  .select(`
    *,
    clients(*),
    profiles(*),
    proposals(*),
    contract_phases(*),
    project_team_assignments(*)
  `)
  .eq('id', projectId)
  .single()

// Phase data
const phases: ProjectPhase[] = project.contract_phases
```

### `index.ts`
Barrel export file for convenient imports.

**Usage:**
```ts
// Import multiple types from one location
import {
  TimeEntry,
  ProjectWithRelations,
  DashboardSummaryMetrics,
  UtilizationData
} from '@/types'
```

## Migration Guide

### Replacing `any` Types

**Before:**
```ts
const entries: any[] = await supabase
  .from('time_entries')
  .select('*')

const project: any = await supabase
  .from('projects')
  .select('*, clients(*)')
  .single()
```

**After:**
```ts
import { TimeEntry, ProjectWithClient } from '@/types'

const entries: TimeEntry[] = await supabase
  .from('time_entries')
  .select('*')

const project: ProjectWithClient = await supabase
  .from('projects')
  .select('*, clients(*)')
  .single()
```

### API Response Typing

**Before:**
```ts
const { data } = useQuery({
  queryFn: async () => {
    const res = await fetch('/api/dashboard/utilization')
    return res.json()
  }
})
```

**After:**
```ts
import { UtilizationApiResponse } from '@/types'

const { data } = useQuery({
  queryFn: async () => {
    const res = await fetch('/api/dashboard/utilization')
    return res.json() as Promise<UtilizationApiResponse>
  }
})
```

## Best Practices

1. **Use specific types over generic ones**
   - Prefer `TimeEntryWithRelations` over `any` when you need related data
   - Use `TimeEntry` for simple queries

2. **Type API responses**
   - Always type your API responses using the provided interfaces
   - This catches errors early and enables autocomplete

3. **Leverage union types**
   - Use `ProjectStatus` instead of string literals
   - Use `TimeEntrySortField` for sort field validation

4. **Document complex types**
   - Add JSDoc comments when creating new interfaces
   - Explain what each field represents

5. **Import from barrel file**
   - Use `import { Type } from '@/types'` for cleaner imports
   - Only import from specific files if you need tree-shaking

## Testing Types

Run TypeScript compiler to check types:

```bash
npm run build
```

Or check specific files:

```bash
npx tsc --noEmit src/types/*.ts
```

## Contributing

When adding new types:

1. Add them to the appropriate file (`time-entries.ts`, `dashboard.ts`, `project.ts`)
2. Export them from the barrel file (`index.ts`)
3. Add JSDoc comments explaining the type
4. Update this README with examples
5. Run `npm run build` to ensure no errors

## Phase 2: Application

**Note:** These type definitions have been created but NOT YET applied to the codebase.

Phase 2 will involve:
1. Replacing `any` types in API routes
2. Updating React Query responses
3. Typing component props
4. Adding proper interfaces to utility functions
5. Running full type-checking across the codebase

See `IRIS_LAUNCH_CRITICAL.md` or the main project board for Phase 2 tracking.
