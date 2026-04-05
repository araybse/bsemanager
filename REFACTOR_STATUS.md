# Project Detail Page Refactor Status

## Objective
Split the 6,244-line god component `projects/[id]/page.tsx` into manageable tab components.

## Completed ✅

### 1. Created `useProjectData.ts` Hook
**Location:** `src/app/(authenticated)/projects/[id]/hooks/useProjectData.ts`

**Purpose:** Centralized data fetching for shared queries

**Queries included:**
- Project details
- Contract phases
- Invoices & invoice line items
- Time entries (all and filtered)
- Expenses
- Subcontract contracts
- Team assignments

**Note:** This hook contains ONLY data fetching logic. All UI state (filters, selections, etc.) remains in components that use it.

### 2. Created OverviewTab Component
**Location:** `src/app/(authenticated)/projects/[id]/tabs/OverviewTab.tsx`

**Lines extracted:** ~250 lines from main page

**Features:**
- Summary cards (Total Contract, Revenue, Cost, Multipliers)
- Phase Progress chart
- Time Distribution chart (employee/phase toggle)
- Performance Over Time charts
- Receives all computed data and state setters as props

**Props:** 22 props including computed values, loading states, and callback functions

### 3. Created TimeTab Component
**Location:** `src/app/(authenticated)/projects/[id]/tabs/TimeTab.tsx`

**Lines extracted:** ~130 lines from main page

**Features:**
- Date range filters
- Employee and phase filters
- Time entries table with hours and costs
- Reset filters button
- Totals row

**Props:** 11 props for filters, data, and permissions

### 4. Updated Main Page
**File:** `src/app/(authenticated)/projects/[id]/page.tsx`

**Changes:**
- Added imports for OverviewTab and TimeTab
- Replaced dashboard TabsContent with <OverviewTab /> component
- Replaced time TabsContent with <TimeTab /> component
- All computed values and state management remain in page.tsx
- Line count reduced from 6,244 to 5,897 (347 lines saved)

**Build Status:** ✅ Passes successfully

## Remaining Work 🔨

The following tabs still need to be extracted from `page.tsx`:

### 1. InvoicesTab
**Lines:** ~110 (est.)
**Current status:** Placeholder created
**Complexity:** Medium - expandable invoice rows, line items display

### 2. ExpensesTab  
**Lines:** ~190 (est.)
**Current status:** Placeholder created
**Complexity:** High - editable charge amounts, billing status updates, subcontract associations

### 3. TeamTab
**Lines:** ~80 (est.)
**Current status:** Placeholder created
**Complexity:** Low - simple table display

### 4. ApplicationsTab
**Lines:** ~160 (est.)
**Current status:** Placeholder created
**Complexity:** Medium - grouped by agency, application generation

### 5. Other Tabs
- Project Info Tab (~100 lines, dynamic schema-based form)
- Agencies & Permits Tab (~360 lines, nested tabs)
- Phases Tab (~110 lines, editable phase list)
- Billables Tab (~150 lines, monthly billables breakdown)
- Contracts Tab (~70 lines, subcontract contracts table)
- Performance Tab (included in Overview for now)

**Total estimated lines to extract:** ~1,330 lines

## Pattern to Follow

For each remaining tab:

1. **Create tab component file** in `tabs/` directory
2. **Identify all JSX** for that tab's `<TabsContent>`
3. **Identify dependencies:**
   - State variables used (e.g., filters, selections)
   - Computed values (memos, derived data)
   - Callbacks (handlers, mutations)
   - Loading states
   - Permission checks
4. **Define props interface** with all dependencies
5. **Extract JSX** to new component
6. **Import and use** in page.tsx with proper props
7. **Test build** to ensure no regressions

## Key Principles

✅ **DO:**
- Keep component state in components (filters, UI toggles)
- Keep shared data queries in useProjectData hook
- Pass computed values as props
- Accept setter functions as props for state management
- Preserve all existing functionality

❌ **DON'T:**
- Move component-specific state to shared hook
- Change business logic during extraction
- Break existing functionality
- Skip build verification

## Architecture

```
projects/[id]/
├── page.tsx (main coordinator - 5,897 lines currently)
│   ├── All state management
│   ├── All computed values (memos)
│   ├── All mutations
│   └── Tab routing
├── hooks/
│   └── useProjectData.ts (shared data queries only)
└── tabs/
    ├── OverviewTab.tsx ✅
    ├── TimeTab.tsx ✅
    ├── InvoicesTab.tsx (placeholder)
    ├── ExpensesTab.tsx (placeholder)
    ├── TeamTab.tsx (placeholder)
    ├── ApplicationsTab.tsx (placeholder)
    └── PerformanceTab.tsx (placeholder)
```

## Next Steps

1. Extract InvoicesTab (simpler than Expenses)
2. Extract TeamTab (simplest)
3. Extract ApplicationsTab
4. Extract ExpensesTab (most complex)
5. Extract remaining tabs
6. Verify all functionality works end-to-end
7. Consider further splitting large computed logic into separate hooks

## Final Goal

Reduce main page.tsx to ~600-800 lines containing only:
- Tab navigation
- State declarations
- Data fetching hooks
- Computed values
- Mutation handlers
- Tab component rendering with props

Each tab component should be 80-250 lines, focused on rendering its specific section.
