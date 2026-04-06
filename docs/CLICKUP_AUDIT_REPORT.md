# ClickUp Workspace Audit Report

**Audit Date:** April 6, 2026  
**Team ID:** 9011205377  
**Prepared for:** IRIS Task Management Phase 2.0 Planning

---

## Executive Summary

This report documents the complete analysis of BSE's ClickUp workspace to inform the design of IRIS's native task management system.

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Tasks | 920 |
| Total Subtasks | 2,487 |
| **Grand Total** | **3,407** |
| Total Spaces | 2 |
| Total Folders | 20 |
| Total Lists | 74 |
| Tasks with Due Dates | 1,393 (41%) |
| Overdue Tasks | 108 |
| Completion Rate | 83.3% |
| Assignment Rate | 34.5% |

---

## 1. Workspace Structure

### 1.1 Space: Admin
- **General** - 140 tasks (admin, misc)
- **Office Relocation** - 69 tasks (historical project)
- **Business Development** - 9 tasks

### 1.2 Space: Land Development
- **Space-level General** - 15 tasks
- **20 Project Folders** with nested lists

### 1.3 Project Folder Pattern
```
[YY-XX Project Name]/
├── General
├── Permits
├── Submittals
├── CA (some projects)
├── Design (some projects)
├── Closeout (some projects)
└── [Agency-specific] (JEA Electric, FDOT, etc.)
```

---

## 2. Task Distribution

### 2.1 By Status

| Status | Count | % |
|--------|-------|---|
| Complete | 2,838 | 83% |
| To Do | 460 | 14% |
| In Progress | 59 | 2% |
| Other | 50 | 1% |

### 2.2 By Assignee

| Assignee | Count | % |
|----------|-------|---|
| Unassigned | 2,232 | 65% |
| Austin Burke | 454 | 13% |
| Austin Ray | 442 | 13% |
| Wesley Koning | 290 | 9% |
| Arber Meta | 97 | 3% |
| Morgan Wilson | 19 | <1% |

### 2.3 By Project (Top 10)

| Project | Tasks |
|---------|-------|
| 25-28 Sabal Preserve Lot Certifications | 858 |
| 25-08 US-1 Flex Space | 276 |
| 25-18 Kayla's Landing | 246 |
| 25-02 Aladdin Road Residential | 219 |
| 24-04 Owens Ranch Townhomes | 208 |
| BSE Improvements | 195 |
| 24-01 Glen Kernan Estate Lots | 189 |
| 25-12 Medical Office | 168 |
| 25-11 North Main St Residential | 152 |
| 25-13 Patriot Hideaway | 143 |

---

## 3. List Types Analysis

### 3.1 Standard Lists (Template Candidates)

| List Type | Frequency | Purpose |
|-----------|-----------|---------|
| General | 18 projects | Miscellaneous project tasks |
| Submittals | 13 projects | Document/plan submissions |
| Permits | 12 projects | Agency permit tracking |
| CA | 6 projects | Construction Administration |
| Design | 3 projects | Design phase tasks |
| Closeout | 3 projects | Project completion tasks |
| JEA Electric | 3 projects | JEA electrical coordination |

### 3.2 List-Specific Patterns

#### Permits List Pattern
Common tasks appearing across projects:
- JEA Plan Approval (6x)
- NPDES NOI (6x)
- SJRWMD ERP (6x)
- JEA Electric Design (5x)
- COJ Plan Approval (4x)
- FDEP DWC (3x)

#### Submittals List Pattern
Common tasks:
- NPDES NOI (3x)
- JEA Final Acceptance (2x)
- SJC (2x)
- COJ Comments (2x)

---

## 4. Custom Fields

### 4.1 Field Definitions

| Field | Type | Options |
|-------|------|---------|
| Agency | Dropdown | COJ, JEA, SJRWMD, FDOT, JEA-E, SJC, Putnam County, FDEP |
| Permit Status | Dropdown | Submitted, RAI, Approved, In Preparation, On-Hold |
| Permit | Dropdown | SJC MDP, COJ Plan Approval, JEA Plan Approval, etc. (23 options) |
| Duration | Formula | Auto-calculated days |
| Comments Due | Date | Agency response deadline |
| Notes | Text | Free-form notes |
| From | Dropdown | From Client, Engineer, Contractor |
| Signature | Dropdown | PE, Client |
| Status | Dropdown | Signed, Needs Signature |

### 4.2 Field Usage

| Field | Tasks Using | % |
|-------|-------------|---|
| Duration | 425 | 12% |
| Agency | 149 | 4% |
| Permit Status | 116 | 3% |
| Notes | 76 | 2% |
| Signature | 34 | 1% |
| Comments Due | 31 | 1% |
| Review Comments/Notes | 24 | 1% |

---

## 5. Workflow Patterns

### 5.1 Permit Review Cycle

```
1st Submittal (manual)
    ↓
1st Review (17 days avg)
    ↓
1st Revision (32 days avg)
    ↓
2nd Submittal
    ↓
2nd Review (15 days avg)
    ↓
... (repeat until approved)
    ↓
Approval
```

Average total permit duration: **21.9 days per cycle**

### 5.2 Submittal Pattern

```
Document preparation → PE/Client signature → Submission → Tracking
```

### 5.3 Closeout Pattern

Standard closeout tasks:
1. Engineer's Final Certification (PE signature)
2. Bill of Sale (Client signature)
3. Owner's Affidavit (Client signature)
4. Material Testing Results
5. COC (Certificate of Completion)
6. As-Built Drawings

---

## 6. Subtask Analysis

### 6.1 Overview
- **Average subtasks per parent:** 2.70
- **Max depth:** 1 level (no sub-subtasks)

### 6.2 By List Type

| List | Subtasks |
|------|----------|
| Lot Certifications | 834 |
| General | 479 |
| Submittals | 273 |
| Permits | 262 |
| CA | 130 |
| Closeout | 96 |

---

## 7. Time Analysis

### 7.1 Due Date Coverage
- 41% of tasks have due dates
- 108 tasks currently overdue

### 7.2 Duration by List Type

| List | Avg Duration | Sample Size |
|------|--------------|-------------|
| Permits | 21.9 days | 275 |
| General | 14.9 days | 119 |
| CA | 10.4 days | 29 |
| Permitting | 8.5 days | 2 |

---

## 8. Recommendations for IRIS

### 8.1 Data Migration
- Import all 3,407 tasks with history
- Map ClickUp list types to IRIS list templates
- Preserve custom field data in JSONB columns

### 8.2 Schema Design
- Create `tasks` table linked to `projects`
- Create `task_lists` table for per-project lists
- Map Agency field to existing `agency_catalog`
- Link Permit Status to `project_permit_selections`

### 8.3 Automation Opportunities
1. Auto-create permit tasks when permits selected
2. Auto-create submittal tasks from required items
3. Update tasks when permit status changes
4. Auto-assign by agency-engineer mapping
5. Due date notifications
6. Closeout task template auto-generation

### 8.4 UI Priorities
1. Project task dashboard
2. My Tasks view
3. Kanban board for status tracking
4. Permit timeline visualization
5. Overdue task alerts

---

## Appendix: Data Files

Generated audit files:
- `data/clickup-audit/clickup-full-audit.json` - Complete task export (3,407 items)
- `data/clickup-audit/clickup-audit-summary.json` - Summary statistics
- `data/clickup-audit/clickup-analysis-results.json` - Pattern analysis

---

*This audit was performed automatically using the ClickUp API. Last updated: April 6, 2026*
