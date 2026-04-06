# Questions for Austin - IRIS Task Management

**Based on ClickUp Audit completed April 6, 2026**

---

## Priority Questions (Need Answers First)

### 1. Standard Project Structure
Currently, I see these list types used across projects:
- **General** (18 projects) - Misc tasks
- **Permits** (12 projects) - Agency permit tracking
- **Submittals** (13 projects) - Document/plan submissions
- **CA** (6 projects) - Construction Administration
- **Design** (3 projects) - Design phase tasks
- **Closeout** (3 projects) - Project completion

**Question:** Should every new project in IRIS automatically get a standard set of lists? If so, which ones are required vs optional?

### 2. Assignment Rules
Currently **65% of tasks are unassigned**. I see patterns like:
- Wesley handles a lot of SJRWMD tasks
- Burke handles JEA-related work
- You (Austin) have admin + oversight tasks

**Question:** Should IRIS auto-assign tasks based on:
- Agency type (SJRWMD → Wesley)?
- Project role (PM always gets certain tasks)?
- Task type (Design tasks → specific engineers)?

### 3. CA List Trigger
Only 6 projects have CA (Construction Admin) lists. 

**Question:** What triggers the need for CA tasks?
- Construction phase begins?
- Specific contract type?
- Manual creation only?

---

## Workflow Questions

### 4. Permit Review Cycles
I see clear patterns like:
```
1st Submittal → 1st Review (avg 17 days) → 1st Revision
2nd Submittal → 2nd Review (avg 15 days) → 2nd Revision
... continues until Approval
```

**Question:** Should IRIS auto-create the next cycle when current review completes? Or keep it manual?

### 5. RAI Response Workflow
When permits get RAI (Review Agency Information) status:
- Tasks have "Comments Due" dates
- Need to create response tasks

**Question:** Do you manually enter the comments due date from agency portal, or can IRIS pull this automatically from anywhere?

### 6. Closeout Trigger
I see standard closeout tasks:
- Engineer's Final Certification
- Bill of Sale
- Owner's Affidavit
- COC (Certificate of Completion)
- As-Built Drawings

**Question:** What triggers closeout? Is it:
- All permits approved?
- Construction complete date passed?
- Manual "Enter Closeout Phase" action?

---

## Integration Questions

### 7. Email → Task Creation
Some tasks clearly originated from emails (client requests, agency comments).

**Question:** How do you currently create tasks from emails?
- Copy/paste manually?
- Forward to ClickUp email address?
- Something else?

Should IRIS have email-to-task capability?

### 8. ClickUp Migration Timeline
Options:
- **Aggressive (30 days):** Quick cutover, import open tasks only
- **Standard (60 days):** Parallel operation, import all tasks
- **Conservative (90 days):** Extended parallel, full historical import

**Question:** Which approach do you prefer? Do you need historical task data in IRIS or just going forward?

### 9. Time Tracking Link
Tasks could link to timesheet entries. This would enable:
- Time spent per task
- Task-level budget tracking
- Auto-populate timesheets from completed tasks

**Question:** Is this valuable, or does it over-complicate things?

---

## Feature Questions

### 10. Client Portal Tasks
Some clients might want to see task progress.

**Question:** Should any task types be visible in the client portal? Which ones?
- Permit status only?
- Submittals?
- All project tasks?

### 11. Mobile Access
**Question:** Do you need mobile task management? If so:
- View only?
- Create/edit tasks?
- Complete tasks?

### 12. Notifications
**Question:** How should IRIS notify about tasks?
- Email digests (daily/weekly)?
- Push notifications?
- In-app only?
- Due date reminders how far in advance?

---

## Data Questions

### 13. Custom Fields to Keep
Currently tracking:
- Duration (auto-calculated)
- Agency (dropdown)
- Permit Status (dropdown)
- Comments Due (date)
- Notes (text)
- Signature (PE/Client)
- Review Comments/Notes

**Question:** Any custom fields to add or remove?

### 14. Lot Certifications (High Volume)
The "25-28 Sabal Preserve Lot Certifications" project has **858 tasks** - this is an outlier.

**Question:** Is lot certification tracking a special workflow that needs dedicated features? Or is this a one-off project?

---

## Quick Decisions Needed

| Decision | Options | Your Choice |
|----------|---------|-------------|
| Default task lists | All / Core only / None | ? |
| Auto-assign by agency | Yes / No | ? |
| Permit cycle auto-create | Yes / No | ? |
| Closeout trigger | Auto / Manual | ? |
| Historical import | All / Open only / None | ? |
| Client portal tasks | Yes / No | ? |

---

*Please review and answer these questions so we can finalize the IRIS Task Management architecture.*
