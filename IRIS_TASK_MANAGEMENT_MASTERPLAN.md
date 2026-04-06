# IRIS Task Management System - Masterplan

**Phase 2.0 Implementation Plan**  
**Document Version:** 1.0  
**Analysis Date:** April 6, 2026  
**Author:** Max (AI Analysis)

---

## Executive Summary

This document outlines the comprehensive plan for integrating task management into IRIS, replacing or augmenting ClickUp as the primary task management system for BSE. Based on deep analysis of the current ClickUp workspace (3,407 total tasks/subtasks across 74 lists in 20 project folders), this plan identifies patterns, workflows, and integration opportunities to build a native IRIS task management system.

### Key Findings

- **3,407 total items** (920 parent tasks + 2,487 subtasks)
- **65% unassigned tasks** - opportunity for automation
- **41% have due dates**, 108 currently overdue
- **Standardized project structure** with General, Submittals, Permits, CA lists
- **Strong alignment** between ClickUp structure and existing IRIS schema

### Recommendation

Build a native IRIS Task Manager that:
1. Mirrors ClickUp's proven project folder → list → task hierarchy
2. Integrates deeply with existing IRIS permit/submittal tracking
3. Automates task creation from permits, submittals, and agency actions
4. Provides unified project dashboard with financial + task views

---

## Part 1: ClickUp Analysis Findings

### 1.1 Workspace Structure

```
Team: BSE (ID: 9011205377)
├── Space: Admin
│   ├── General (140 tasks)
│   ├── Office Relocation (69 tasks)
│   └── Business Development (9 tasks)
│
└── Space: Land Development
    ├── Space-level General (15 tasks)
    └── Project Folders (20 total)
        ├── 23-XX Projects (2 folders, 246 tasks)
        ├── 24-XX Projects (4 folders, 425 tasks)
        ├── 25-XX Projects (11 folders, 2,016 tasks)
        ├── 26-XX Projects (2 folders, 132 tasks)
        └── BSE Improvements (195 tasks)
```

### 1.2 Standard List Types (per project)

| List Type | Frequency | Purpose |
|-----------|-----------|---------|
| **General** | 18 projects | General project tasks, communications |
| **Submittals** | 13 projects | Plan submittal tracking to agencies |
| **Permits** | 12 projects | Permit application/approval tracking |
| **CA** | 6 projects | Construction Administration tasks |
| **JEA Electric** | 3 projects | JEA electrical coordination |
| **Design** | 3 projects | Design-phase tasks |
| **Closeout** | 3 projects | Project closeout documentation |

### 1.3 Task Distribution by Status

| Status | Count | Percentage |
|--------|-------|------------|
| Complete | 2,838 | 83% |
| To Do | 460 | 13% |
| In Progress | 59 | 2% |
| Other Custom | 50 | 2% |

### 1.4 Assignment Patterns

| Assignee | Tasks | Percentage |
|----------|-------|------------|
| Unassigned | 2,232 | 65% |
| Austin Burke | 454 | 13% |
| Austin Ray | 442 | 13% |
| Wesley Koning | 290 | 9% |
| Arber Meta | 97 | 3% |
| Morgan Wilson | 19 | 1% |

### 1.5 Custom Fields in Use

| Field Name | Type | Usage Count | Purpose |
|------------|------|-------------|---------|
| Duration | Formula | 425 | Auto-calculates days in status |
| Agency | Dropdown | 149 | FDEP, JEA, SJC, SJRWMD, COJ, etc. |
| Permit Status | Dropdown | 116 | Submitted, Approved, RAI, etc. |
| Notes | Text | 76 | Free-form notes |
| Signature | Dropdown | 34 | PE, Client |
| Status | Dropdown | 34 | Needs Signature |
| Comments Due | Date | 31 | Agency comment deadline |
| Review Comments/Notes | Text | 24 | Comment response notes |

### 1.6 Top Projects by Task Volume

| Project | Tasks | Notes |
|---------|-------|-------|
| 25-28 Sabal Preserve Lot Certifications | 858 | High-volume certification work |
| 25-08 US-1 Flex Space | 276 | Active design project |
| 25-18 Kayla's Landing | 246 | Complex multi-phase project |
| 25-02 Aladdin Road Residential | 219 | CA + permitting active |
| 24-04 Owens Ranch Townhomes | 208 | Active construction |

---

## Part 2: Existing IRIS Architecture Analysis

### 2.1 Relevant Database Tables

IRIS already has significant infrastructure that aligns with task management needs:

#### Agency & Permit System (Phase 4)
- `agency_catalog` - Master list of agencies (JEA, FDEP, SJRWMD, COJ, etc.)
- `permit_catalog` - Permit types per agency
- `project_permit_selections` - Per-project permit tracking with statuses
- `project_required_items` - Required documents/applications per permit
- `permit_required_item_catalog` - Standard required items per permit type

#### Project Structure
- `projects` - Core project table with project numbers
- `project_agencies` - Agencies relevant to each project
- `project_info` - Extended project metadata

#### CAM System (Phase 3)
- `cam_field_freshness` - Tracks data sync state
- `cam_sync_events` - Audit log for integrations
- `cad_publish_queue` - Queue for CAD updates

### 2.2 Integration Opportunities

| ClickUp Concept | IRIS Equivalent | Integration Strategy |
|-----------------|-----------------|---------------------|
| Project Folder | `projects` table | 1:1 mapping by project_number |
| Permits List | `project_permit_selections` | Auto-generate tasks from permit status changes |
| Submittals List | `project_required_items` | Create submittal tracking tasks |
| Agency dropdown | `agency_catalog` | Shared reference data |
| Permit Status | `project_permit_selections.status` | Bidirectional sync |
| CA List | New `project_ca_items` table | Extend for construction admin |

---

## Part 3: Proposed IRIS Task Architecture

### 3.1 Data Model

```sql
-- Core task table
create table public.tasks (
  id bigserial primary key,
  project_id bigint not null references projects(id),
  list_id bigint not null references task_lists(id),
  parent_task_id bigint references tasks(id),
  
  -- Core fields
  title text not null,
  description text,
  status text not null default 'to_do',
  priority text check (priority in ('urgent', 'high', 'normal', 'low', 'none')),
  
  -- Dates
  due_date timestamptz,
  start_date timestamptz,
  completed_at timestamptz,
  
  -- Assignments
  assignees uuid[] default '{}',
  created_by uuid references profiles(id),
  
  -- Linking
  permit_selection_id bigint references project_permit_selections(id),
  required_item_id bigint references project_required_items(id),
  agency_id bigint references agency_catalog(id),
  
  -- Custom fields (JSONB for flexibility)
  custom_fields jsonb default '{}',
  
  -- ClickUp sync (during migration)
  clickup_id text unique,
  clickup_synced_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- List types per project
create table public.task_lists (
  id bigserial primary key,
  project_id bigint not null references projects(id),
  name text not null,
  list_type text not null check (list_type in (
    'general', 'permits', 'submittals', 'ca', 
    'design', 'closeout', 'jea_electric', 'custom'
  )),
  sort_order integer default 0,
  is_archived boolean default false,
  created_at timestamptz default now(),
  
  unique (project_id, name)
);

-- Standard list templates
create table public.task_list_templates (
  id bigserial primary key,
  name text not null unique,
  list_type text not null,
  default_tasks jsonb default '[]',
  is_default boolean default false
);

-- Task custom field definitions
create table public.task_custom_field_definitions (
  id bigserial primary key,
  name text not null unique,
  field_type text not null check (field_type in (
    'text', 'dropdown', 'date', 'number', 'checkbox', 'user'
  )),
  options jsonb default '[]',
  is_global boolean default true
);
```

### 3.2 Status Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   To Do     │───▶│ In Progress │───▶│  Complete   │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Blocked   │
                   └─────────────┘

Permit-specific statuses:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ In Preparation│───▶│  Submitted   │───▶│   Approved   │
└──────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │     RAI      │──▶ (Response) ──▶ Resubmitted
                   └──────────────┘
```

### 3.3 Automation Triggers

| Trigger | Action |
|---------|--------|
| New permit selection added | Create "Prepare [Permit] Application" task |
| Required item added | Create "Obtain [Item]" task in Submittals |
| Permit status → Submitted | Create "Track [Agency] Review" task |
| Permit status → RAI | Create "Respond to [Agency] Comments" task with due date |
| Comment due date approaching | Send notification, update task priority |
| All permits approved | Create Closeout tasks from template |

---

## Part 4: Workflow Documentation

### 4.1 Design → Submittals → Permits Workflow

```
DESIGN PHASE
├── Design tasks (manual creation)
├── Plan completion milestones
└── Internal review checklists

     ↓ (triggers on design phase complete)

SUBMITTALS PHASE  
├── Auto-create required items from permit_required_item_catalog
├── Track document status: pending → received → in_progress → submitted
├── Link to agency contacts
└── Upload/attach documents

     ↓ (triggers when all required items received)

PERMITS PHASE
├── Auto-create permit tasks from project_permit_selections
├── Track: in_preparation → submitted → under_review → [approved|rai]
├── Agency-specific subtasks (JEA, SJRWMD, COJ, etc.)
└── Due date tracking from permit status changes
```

### 4.2 Agency Comments Response Workflow

```
1. Permit status changes to "RAI" (Review Agency Information)
2. System creates task: "Respond to [Agency] Comments - [Project]"
3. Auto-sets due date from custom field "Comments Due"
4. Notifies assigned engineers
5. Subtasks created for each comment category:
   - Site Plan revisions
   - Drainage recalculations  
   - Utility plan updates
   - etc.
6. On subtask completion → check if all resolved
7. When complete → update permit status to "Resubmitted"
```

### 4.3 Permit Tracking Timeline

```
Task: "COJ Site Plan Permit"
├── Subtask: 1st Submittal (Date: XX, Duration: calculated)
├── Subtask: 1st Review (Date: XX, Duration: calculated)
├── Subtask: 1st Revision (Date: XX, Duration: calculated)
├── Subtask: 2nd Submittal (Date: XX)
├── Subtask: 2nd Review (Date: XX)
├── ... (pattern continues)
└── Subtask: Approval (Date: XX)

Duration field = days between submittal and review
Total timeline visible in parent task
```

### 4.4 Closeout Task Template

```
When project enters closeout phase, auto-generate:
├── Engineer's Final Certification
│   └── Subtask: Obtain PE signature
├── Bill of Sale
│   └── Subtask: Obtain client signature
├── Owner's Affidavit  
│   └── Subtask: Obtain client signature
├── Material Testing Results
│   └── Subtask: Request from contractor
├── COC (Certificate of Completion)
│   └── Subtask: Submit to FDEP
└── As-Built Drawings
    └── Subtask: Complete as-built revisions
```

---

## Part 5: UI Design Concepts

### 5.1 Project Task Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ 25-18 Kayla's Landing                            [⋮ More]   │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [Tasks] [Permits] [Submittals] [Documents] [Time]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Task Summary                    │ Permits Status           │
│  ├─ 85 Tasks (12 open)          │ ├─ COJ Site: Approved ✓  │
│  ├─ 5 Overdue                    │ ├─ JEA Water: In Review  │
│  └─ 3 Due this week             │ └─ SJRWMD: RAI ⚠️        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Task Board View                          [List|Board]│   │
│  ├──────────┬──────────┬──────────┬──────────┬─────────┤   │
│  │ TO DO    │ PROGRESS │ REVIEW   │ COMPLETE │ BLOCKED │   │
│  ├──────────┼──────────┼──────────┼──────────┼─────────┤   │
│  │ □ Task 1 │ □ Task 4 │ □ Task 7 │ ✓ Task 9 │ ⚠ Task  │   │
│  │ □ Task 2 │ □ Task 5 │ □ Task 8 │ ✓ Task10 │         │   │
│  │ □ Task 3 │ □ Task 6 │          │ ✓ Task11 │         │   │
│  └──────────┴──────────┴──────────┴──────────┴─────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 My Tasks View (Personal Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│ My Tasks                                    [Filter▾] [+ New]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ OVERDUE (3)                                              │
│ ├─ □ Respond to SJRWMD Comments        25-18 Kayla's       │
│ ├─ □ Update drainage calcs             25-02 Aladdin       │
│ └─ □ Submit revised site plan          26-03 Burbank       │
│                                                             │
│ 📅 TODAY (5)                                                │
│ ├─ □ JEA coordination call             25-11 North Main    │
│ ├─ □ Review contractor RFI             24-04 Owens Ranch   │
│ └─ ...                                                      │
│                                                             │
│ 📅 THIS WEEK (12)                                           │
│ └─ ...                                                      │
│                                                             │
│ 📥 UPCOMING                                                 │
│ └─ ...                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Permit Timeline View

```
┌─────────────────────────────────────────────────────────────┐
│ Permit Timeline: COJ Site Plan                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 2024-08-01    1st Submittal ●──────────────────────────    │
│                              │                              │
│               17 days        │                              │
│                              │                              │
│ 2024-08-18    1st Review    ●──────────────────────────    │
│                              │                              │
│               32 days        │                              │
│                              │                              │
│ 2024-09-19    1st Revision  ●──────────────────────────    │
│                              │                              │
│ 2024-09-23    2nd Submittal ●──────────────────────────    │
│                              │                              │
│ ...                                                         │
│                                                             │
│ Total Duration: 67 days                                     │
│ Current Status: Under Review                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 6: Integration Points

### 6.1 Email → Task Creation

```javascript
// Integration with email system
// When email matches project pattern, offer task creation

const emailPatterns = [
  /RE: (\d{2}-\d{2})/,           // Project number in subject
  /comments due/i,               // Agency comments
  /permit (approved|denied)/i,   // Permit status
  /RFI/i,                        // Request for Information
];

// Create task from email
function createTaskFromEmail(email, project) {
  return {
    title: `Email: ${email.subject}`,
    description: email.body.substring(0, 500),
    project_id: project.id,
    list_id: determineList(email), // General, or specific
    custom_fields: {
      email_source: email.id,
      email_from: email.from,
    }
  };
}
```

### 6.2 Permit Status → Task Automation

```javascript
// Database trigger or API webhook
async function onPermitStatusChange(permitSelection, oldStatus, newStatus) {
  const project = await getProject(permitSelection.project_id);
  const agency = await getAgency(permitSelection);
  
  if (newStatus === 'rai') {
    // Create response task
    await createTask({
      project_id: project.id,
      list_type: 'permits',
      title: `Respond to ${agency.name} Comments - ${project.project_number}`,
      description: `RAI received, comments due by ${permitSelection.comments_due}`,
      due_date: permitSelection.comments_due,
      priority: 'high',
      permit_selection_id: permitSelection.id,
    });
  }
  
  if (newStatus === 'approved') {
    // Mark related tasks complete
    await completeTasks({
      permit_selection_id: permitSelection.id,
      status: 'in_progress'
    });
  }
}
```

### 6.3 ClickUp Sync (Migration Period)

```javascript
// Bidirectional sync during transition
const SYNC_CONFIG = {
  clickup_to_iris: {
    task_create: true,
    task_update: true,
    status_change: true,
    assignee_change: true,
  },
  iris_to_clickup: {
    task_create: false,  // Create in IRIS first
    status_change: true, // Keep ClickUp updated
    comments: false,     // IRIS is source of truth
  },
  mapping: {
    statuses: {
      'to do': 'to_do',
      'in progress': 'in_progress', 
      'complete': 'complete',
    },
    lists: {
      'General': 'general',
      'Permits': 'permits',
      'Submittals': 'submittals',
      'CA': 'ca',
    }
  }
};
```

---

## Part 7: Migration Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Create database tables (tasks, task_lists, etc.)
- [ ] Implement RLS policies
- [ ] Build basic CRUD API endpoints
- [ ] Create task list templates

### Phase 2: Core UI (Week 3-4)
- [ ] Project task dashboard
- [ ] Task list/board views
- [ ] Task detail modal
- [ ] My Tasks dashboard

### Phase 3: Integration (Week 5-6)
- [ ] Link tasks to permits/submittals
- [ ] Auto-task creation from permit changes
- [ ] Email → task integration
- [ ] Due date notifications

### Phase 4: ClickUp Migration (Week 7-8)
- [ ] Import historical tasks from ClickUp
- [ ] Set up bidirectional sync
- [ ] User training
- [ ] Parallel operation validation

### Phase 5: Full Cutover (Week 9+)
- [ ] Disable ClickUp write access
- [ ] IRIS as sole task system
- [ ] Archive ClickUp workspace (read-only)

---

## Part 8: Open Questions for Austin

### Task Structure
1. **Standard Lists**: Should every project automatically get General + Permits + Submittals lists, or should this be configurable per project type?

2. **CA List**: The Construction Administration list appears on some projects but not all. What triggers CA work - is it a contract phase or project status?

3. **Subtask Limits**: Some permit tasks have many subtasks (10+ review cycles). Should we limit nesting depth or create a different "timeline" view?

### Assignments
4. **Default Assignments**: Currently 65% of tasks are unassigned. Should IRIS auto-assign based on:
   - Project manager role?
   - Agency type (Wesley = SJRWMD, Burke = JEA)?
   - Task type?

5. **Multi-Assignee**: ClickUp allows multiple assignees. Is this used intentionally or should we enforce single-owner?

### Workflow
6. **Permit Workflow**: The submittal/review/revision cycle is clear. Should tasks auto-create each cycle, or manual?

7. **Closeout Triggers**: What determines when a project enters closeout? Is it:
   - All permits approved?
   - Construction complete date?
   - Manual trigger?

8. **Comment Due Dates**: These are critical. Should IRIS pull these from agency portals automatically, or always manual entry?

### Integration
9. **Email Tasks**: How often do emails need to become tasks? Should this be:
   - Automatic based on patterns?
   - Button in email client?
   - Manual copy-paste?

10. **ClickUp Migration Timeline**: 
    - Keep ClickUp for 30/60/90 days?
    - Full historical import or just open tasks?
    - Archive or delete ClickUp workspace?

### Features
11. **Time Tracking**: Should tasks link to time entries? This could enable:
    - Task-level time tracking
    - Budget vs actual per task
    - Auto-populate timesheet from tasks

12. **Client Portal**: Should clients see task progress? Which task types?

---

## Part 9: Implementation Priorities

### Must Have (MVP)
- [ ] Tasks table with project/list linking
- [ ] Basic task CRUD (create, edit, complete)
- [ ] Project task list view
- [ ] My Tasks view
- [ ] Link to permits/submittals

### Should Have (v1.1)
- [ ] Kanban board view
- [ ] Task templates
- [ ] Auto-create from permit status
- [ ] Due date notifications
- [ ] ClickUp import

### Nice to Have (v1.2+)
- [ ] Email integration
- [ ] Time tracking link
- [ ] Mobile task view
- [ ] Recurring tasks
- [ ] Dependencies/blockers

---

## Appendix A: ClickUp API Reference

```javascript
// Fetch tasks for migration
const ENDPOINTS = {
  spaces: `/api/v2/team/${TEAM_ID}/space`,
  folders: `/api/v2/space/{space_id}/folder`,
  lists: `/api/v2/folder/{folder_id}/list`,
  tasks: `/api/v2/list/{list_id}/task?include_closed=true&subtasks=true`,
  task: `/api/v2/task/{task_id}`,
};

// Rate limits: 100 requests/minute
// Pagination: 100 tasks per page
```

## Appendix B: Database Sizing Estimates

Based on current ClickUp data:
- ~3,500 existing tasks to migrate
- ~5-10 new projects per year
- ~50-100 tasks per active project
- **Estimated Year 1**: 5,000-7,000 tasks
- **5-Year projection**: 15,000-25,000 tasks

Storage impact: Minimal (<100MB including all history)

---

*Document prepared by Max. Review with Austin before implementation.*
