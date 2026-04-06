# Status Column - Entries Tab Enhancement

## Overview
Added a Status column to the Time → Entries tab to display the approval status of each time entry with color-coded badges.

## Visual Representation

### BEFORE:
```
┌─────────────────────────────────────────────────────────────────────┐
│ Time Entries                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Date ▼     Employee      Project    Phase           Hours           │
├─────────────────────────────────────────────────────────────────────┤
│ 04/05/26   John Doe      PRJ-001    Design          8.0             │
│ 04/04/26   Jane Smith    PRJ-002    Survey          6.5             │
│ 04/03/26   John Doe      PRJ-001    Analysis        7.0             │
└─────────────────────────────────────────────────────────────────────┘
```

### AFTER:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Time Entries                                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Date ▼     Status        Employee      Project    Phase      Hours      │
├──────────────────────────────────────────────────────────────────────────┤
│ 04/05/26   [Approved]    John Doe      PRJ-001    Design     8.0        │
│            ^^^^^^^^^^                                                    │
│            Green badge                                                   │
│                                                                          │
│ 04/04/26   [Submitted]   Jane Smith    PRJ-002    Survey     6.5        │
│            ^^^^^^^^^^^                                                   │
│            Amber badge                                                   │
│                                                                          │
│ 04/03/26   [Draft]       John Doe      PRJ-001    Analysis   7.0        │
│            ^^^^^^^                                                       │
│            Gray badge                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Badge Color Scheme

### Draft
```
┌─────────┐
│  Draft  │  bg-gray-100 text-gray-800
└─────────┘
```
- **When:** Entry is created but not yet submitted
- **Visual:** Light gray background, dark gray text
- **Meaning:** Work in progress, can be edited freely

### Submitted
```
┌───────────┐
│ Submitted │  bg-amber-100 text-amber-800
└───────────┘
```
- **When:** Employee has submitted the timesheet for approval
- **Visual:** Light amber background, dark amber text
- **Meaning:** Awaiting manager review, limited editing

### Approved
```
┌──────────┐
│ Approved │  bg-green-100 text-green-800
└──────────┘
```
- **When:** Manager/admin has approved the entry
- **Visual:** Light green background, dark green text
- **Meaning:** Finalized, locked for editing (unless admin)

## Implementation Details

### Database Schema
The `time_entries` table already has the `status` field:
```sql
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
CHECK (status IN ('draft', 'submitted', 'approved'));
```

### Query Update
Added `status` to the SELECT clause:
```typescript
.select('id, employee_id, employee_name, entry_date, hours, project_number, phase_name, status')
```

### Badge Component
Using the UI Badge component with custom classes:
```tsx
<Badge className={getStatusBadgeClass(entry.status)}>
  {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
</Badge>
```

### Helper Functions
```typescript
function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'approved':
      return 'bg-green-100 text-green-800 hover:bg-green-100'
    case 'submitted':
      return 'bg-amber-100 text-amber-800 hover:bg-amber-100'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
  }
}
```

## User Experience

### For Employees:
- **Quick Status Check:** See at a glance which entries are approved, submitted, or still draft
- **Workflow Clarity:** Understand which timesheets are awaiting approval
- **Visual Feedback:** Color-coded badges make status immediately obvious

### For Managers/Admins:
- **Review Efficiency:** Quickly identify submitted entries that need approval
- **Audit Trail:** See historical status of all time entries
- **Filtering Potential:** (Future enhancement) Filter by status to see only pending approvals

## Related Workflows

This status column integrates with the existing timesheet workflow:

1. **Employee creates entry** → Status: `Draft` (gray)
2. **Employee submits timesheet** → Status: `Submitted` (amber)
3. **Manager approves** → Status: `Approved` (green)

## Future Enhancements

Potential improvements for the status column:

### 1. Status Filter
Add a dropdown to filter entries by status:
```tsx
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectItem value="all">All Statuses</SelectItem>
  <SelectItem value="draft">Draft Only</SelectItem>
  <SelectItem value="submitted">Submitted Only</SelectItem>
  <SelectItem value="approved">Approved Only</SelectItem>
</Select>
```

### 2. Status Counts
Show count summary at the top:
```
Draft: 12  |  Submitted: 8  |  Approved: 156
```

### 3. Bulk Status Actions
For admins, allow bulk approve/reject:
```
[✓] Select All Submitted  [Approve Selected] [Reject Selected]
```

### 4. Status History Tooltip
Hover to see approval timeline:
```
Draft → 04/01/26 12:30 PM
Submitted → 04/05/26 5:45 PM (by John Doe)
Approved → 04/06/26 9:15 AM (by Manager Smith)
```

### 5. Status Icons
Add icons for visual clarity:
```
📝 Draft
⏳ Submitted
✅ Approved
❌ Rejected (if we add this status)
```

## Technical Notes

### Column Order
Status is placed after Date for logical flow:
1. **Date** - When the work was done
2. **Status** - Current approval state
3. **Employee** - Who did the work
4. **Project/Phase** - What was worked on
5. **Hours** - How much time spent

### Responsive Considerations
On mobile/tablet, status badges should:
- Remain visible (don't hide on small screens)
- Stack appropriately if needed
- Maintain color coding for quick scanning

### Performance
Status is fetched with the initial query (no additional API call), so:
- No performance impact
- Status available immediately
- Works with existing pagination

## Testing Checklist

- [x] Build completes without errors
- [ ] Status column appears after Date
- [ ] Draft badges are gray
- [ ] Submitted badges are amber
- [ ] Approved badges are green
- [ ] Status text is capitalized
- [ ] Badges don't break layout
- [ ] Works with filters and pagination
- [ ] Colspan values are correct (6 columns total)
- [ ] Mobile/responsive layout tested
