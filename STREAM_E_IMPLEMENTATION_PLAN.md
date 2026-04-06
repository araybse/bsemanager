# Stream E: UI Components & Review Queue - Implementation Plan

**Agent:** Sam  
**Date:** 2026-04-06  
**Status:** In Progress

## Overview

Building complete UI layer for Phase 2 Living Memory Foundation, integrating with backend streams A-D.

## Implementation Order

### Phase 1: Backend Integration Layer (API Routes)
1. Entity Review API Routes
2. Actions API Routes  
3. Knowledge Graph API Routes

### Phase 2: Core UI Components
4. Entity Merge Review Interface
5. Action Tracking Dashboard
6. Knowledge Search Interface

### Phase 3: Advanced Visualizations
7. Relationship Visualization (Graph)
8. Project Knowledge Tab Extension
9. Dashboard Widgets

### Phase 4: Testing & Documentation
10. Integration Tests
11. User Documentation

## Progress Tracker

- [ ] API Routes Created
  - [ ] `/api/admin/entity-review/queue`
  - [ ] `/api/admin/entity-review/merge`
  - [ ] `/api/admin/entity-review/reject`
  - [ ] `/api/admin/actions` (GET with filters)
  - [ ] `/api/admin/actions/[id]/status` (PATCH)
  - [ ] `/api/admin/actions/overdue` (GET)
  - [ ] `/api/knowledge-graph/query` (POST)
  - [ ] `/api/knowledge-graph/entity/[id]/related` (GET)
  - [ ] `/api/knowledge-graph/project/[id]` (GET)

- [ ] UI Pages Created
  - [ ] `/admin/entity-review/page.tsx`
  - [ ] `/admin/actions/page.tsx`
  - [ ] `/search/page.tsx`
  - [ ] `/admin/knowledge-graph/page.tsx`

- [ ] Dashboard Enhancements
  - [ ] Overdue Actions Widget
  - [ ] Recent Insights Widget
  - [ ] Quick Search Widget

- [ ] Project Page Enhancement
  - [ ] Knowledge Tab Added

- [ ] Tests
  - [ ] `phase2-ui.test.tsx`

- [ ] Documentation
  - [ ] `docs/PHASE_2_UI.md`

## Technical Notes

- Using existing IRIS design patterns (Shadcn/UI, Tailwind)
- Following authenticated route structure: `(authenticated)/admin/...`
- Integrating with Supabase for backend queries
- Using React Query for data fetching
- TypeScript for type safety

## Dependencies

**Backend Functions (from other streams):**
- Oliver (Stream A): Entity resolution functions
- Sebastian (Stream B): Relationship management functions
- Sophia (Stream C): Action lifecycle functions
- Henry (Stream D): Knowledge graph query functions

**Note:** If backend functions aren't available yet, will create mock implementations for UI development.
