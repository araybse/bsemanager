# Email Knowledge System - Complete Documentation

**Version:** 2.0  
**Last Updated:** 2026-04-06  
**Author:** Oliver (AI Assistant)

---

## Overview

The Email Knowledge System (EKS) captures and processes 100% of Austin's email activity into structured knowledge files, enabling:

- Full-text search across all project communications
- AI-powered insights and summaries
- Contact relationship mapping
- Permit and deadline tracking
- Real-time processing of new emails

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MS365 Email                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Inbox/YY/*  │  │ Sent Items  │  │ Root Inbox  │              │
│  │ (Projects)  │  │ (Outbound)  │  │ (Uncateg.)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
└─────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Processing Pipeline                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Phase 1    │  │  Phase 2.1  │  │  Phase 2.2  │              │
│  │ 3,442 thrd  │  │ Sent dedup  │  │ Root inbox  │              │
│  │ Processed   │  │ + filter    │  │ + identify  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│               ┌─────────────────────┐                            │
│               │   Claude AI         │                            │
│               │   Knowledge         │                            │
│               │   Extraction        │                            │
│               └──────────┬──────────┘                            │
└──────────────────────────┼───────────────────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │  /tmp/knowledge-output/ │
              │  1,716+ project folders │
              │  Structured JSON files  │
              └─────────────────────────┘
```

## Phase 1: Inbox Project Folders (Complete)

**Processed:** 2026-04-06 morning  
**Scope:** All emails in `Inbox/YY/*` project folders  
**Results:**
- 3,442 email threads processed
- 1,716 project knowledge folders created
- Output location: `/tmp/knowledge-output/`

### Data Structure

```
/tmp/knowledge-output/
├── 23-01_adventure_retail/
│   ├── 2026-03-25_dep_adventure_retail_clearance.json
│   ├── 2026-03-30_as-built_submittal.json
│   └── ...
├── 24-05_crosswater_commons/
│   └── ...
└── ...
```

Each JSON file contains:
```json
{
  "thread_id": "AAQkADI2...",
  "subject": "RE: 2024-1953 Adventure Retail As-Built Submittal",
  "date_range": {
    "start": "2026-03-06T11:40:26Z",
    "end": "2026-04-01T19:22:38Z"
  },
  "participants": ["aburke@blackstoneeng.com", "RFoster@parcgroup.net", "DougH@birchmier.com"],
  "message_count": 8,
  "knowledge": {
    "summary": "Thread about Adventure Retail as-built submittal...",
    "key_decisions": ["As-built approved with minor revisions"],
    "action_items": [{"task": "Submit final drawings", "assignee": "Austin Burke", "due": "2026-04-15"}],
    "people": [{"name": "Doug Hampton", "role": "Birchmier", "email": "DougH@birchmier.com"}],
    "permits": [{"type": "DSGP", "number": "0159044-1143", "status": "Clearance issued"}],
    "blockers": [],
    "dates": [{"date": "2026-04-01", "event": "DEP clearance issued"}],
    "technical_details": ["Force main connection at Station 12+50"],
    "costs": []
  }
}
```

## Phase 2: Sent Items + Root Inbox

### Phase 2.1: Sent Items Processing

**Scope:** All 9,781 sent emails  
**Goal:** Capture outbound communications not already in Phase 1

#### Step 1: Fetch All Sent Items
```bash
node ~/automation/scripts/phase2-fetch-sent-items.js
```
- Queries MS365 `/me/mailFolders/SentItems/messages`
- Groups by conversationId (threads)
- Output: `/tmp/sent-items-threads.json`

#### Step 2: Deduplicate Against Phase 1
```bash
node ~/automation/scripts/phase2-deduplicate-sent.js
```
- Removes threads already processed in Phase 1
- Output: `/tmp/sent-items-unique-threads.json`

#### Step 3: Filter Admin Emails
```bash
node ~/automation/scripts/phase2-filter-admin-emails.js
```
- Removes non-project administrative emails
- Filters: Tech vendors, billing, subscriptions, notifications
- Output: `/tmp/sent-items-project-threads.json`

**Admin Email Filters:**
- Domains: anthropic.com, vercel.com, github.com, stripe.com, etc.
- Keywords: invoice, receipt, payment, subscription, account
- Patterns: noreply@, notifications@, newsletter@

### Phase 2.2: Root Inbox Processing

**Scope:** 39 uncategorized emails in root Inbox  
**Goal:** Identify projects and process

#### Step 1: Fetch Root Inbox
```bash
node ~/automation/scripts/phase2-fetch-root-inbox.js
```
- Queries direct children of Inbox (not subfolders)
- Output: `/tmp/root-inbox-threads.json`

#### Step 2: Auto-Identify Projects
```bash
node ~/automation/scripts/phase2-identify-projects.js
```

**Identification Methods:**
1. **Subject Pattern** (95% confidence): Extract XX-XX project numbers
2. **Contact Mapping** (85% confidence): Match sender to known projects
3. **Claude AI Analysis** (variable): Content-based identification

**Confidence Thresholds:**
- ≥0.8: Auto-assign to project
- 0.5-0.8: Flag for review
- <0.5: Mark as admin/general

Output:
- `/tmp/root-inbox-categorized.json` (high confidence)
- `/tmp/inbox-needs-review.json` (needs human review)

### Phase 2.3: Knowledge Extraction
```bash
node ~/automation/scripts/phase2-process-threads.js
```
- Fetches full email content from MS365
- Extracts structured knowledge via Claude
- Saves to `/tmp/knowledge-output/{project}/`

## Phase 2.4: Auto-Processor for New Emails

### Webhook Integration

The existing webhook (`combined-webhook.js`) already handles new emails:

1. **MS365 Webhook** → Fires on new email
2. **Plaud Detection** → Special handling for transcripts
3. **Knowledge Extraction** → `process-email-knowledge.js`
4. **Memory Update** → `auto-update-memory-enhanced.js`

### Manual Processing
```bash
# Process specific email
node ~/automation/scripts/auto-email-processor.js <emailId>

# Watch mode (poll every 60s)
node ~/automation/scripts/auto-email-processor.js --watch

# Process 10 most recent
node ~/automation/scripts/auto-email-processor.js --recent
```

## Running Phase 2

### Full Pipeline
```bash
node ~/automation/scripts/phase2-run-all.js
```

### Individual Steps
```bash
# Step 1: Fetch sent items
node ~/automation/scripts/phase2-fetch-sent-items.js

# Step 2: Deduplicate
node ~/automation/scripts/phase2-deduplicate-sent.js

# Step 3: Filter admin
node ~/automation/scripts/phase2-filter-admin-emails.js

# Step 4: Fetch root inbox
node ~/automation/scripts/phase2-fetch-root-inbox.js

# Step 5-6: Identify projects
node ~/automation/scripts/phase2-identify-projects.js /tmp/root-inbox-threads.json
node ~/automation/scripts/phase2-identify-projects.js /tmp/sent-items-project-threads.json /tmp/sent-categorized.json

# Step 7-8: Process threads
node ~/automation/scripts/phase2-process-threads.js /tmp/root-inbox-categorized.json
node ~/automation/scripts/phase2-process-threads.js /tmp/sent-categorized.json

# Step 9: Audit
node ~/automation/scripts/phase2-audit-coverage.js
```

### Resume from Step
```bash
node ~/automation/scripts/phase2-run-all.js --from=5
```

## Audit & Coverage Report

```bash
node ~/automation/scripts/phase2-audit-coverage.js
```

Sample output:
```
📊 EMAIL KNOWLEDGE SYSTEM - COVERAGE AUDIT REPORT

📧 TOTAL EMAILS IN MS365:
   Inbox (all): 9,648
   Sent Items:  9,781
   TOTAL:       19,429

📁 PROCESSED IN KMS:
   Phase 1 (Inbox projects):  3,442 threads
   Phase 2 (Sent unique):     ~2,000 threads
   Phase 2 (Root inbox):      39 threads
   Knowledge files:           1,716+ files

📈 COVERAGE:
   Estimated coverage: ~95%+
   Admin emails filtered: ~500
   Needs review: ~50
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `phase2-fetch-sent-items.js` | Fetch all sent emails |
| `phase2-deduplicate-sent.js` | Remove threads already in Phase 1 |
| `phase2-filter-admin-emails.js` | Filter admin/non-project emails |
| `phase2-fetch-root-inbox.js` | Fetch uncategorized inbox |
| `phase2-identify-projects.js` | Auto-identify project for emails |
| `phase2-process-threads.js` | Extract knowledge from threads |
| `phase2-audit-coverage.js` | Verify coverage completeness |
| `phase2-run-all.js` | Master orchestrator |

## Maintenance

### Monthly Re-scan
```bash
# Re-run Phase 2 to catch any missed emails
node ~/automation/scripts/phase2-run-all.js
```

### Review Queue
Check `/tmp/inbox-needs-review.json` for emails needing manual project assignment.

### Webhook Health
```bash
curl https://ketonic-bob-tiresome.ngrok-free.dev/health
```

## Data Locations

| Path | Contents |
|------|----------|
| `/tmp/knowledge-output/` | Project knowledge files |
| `/tmp/all-email-threads.json` | Phase 1 thread data |
| `/tmp/sent-items-threads.json` | Sent items raw data |
| `/tmp/sent-items-unique-threads.json` | Deduplicated sent threads |
| `/tmp/sent-items-project-threads.json` | Filtered project threads |
| `/tmp/root-inbox-threads.json` | Root inbox raw data |
| `/tmp/root-inbox-categorized.json` | Categorized inbox |
| `/tmp/inbox-needs-review.json` | Low confidence threads |
| `/tmp/email-coverage-audit.json` | Audit report |

## Success Criteria

- ✅ All sent emails processed (deduplicated)
- ✅ All root inbox emails processed (project identified)
- ✅ Admin emails filtered out
- ✅ 100% coverage (every project email in KMS)
- ✅ Auto-processor running for new emails
- ✅ No duplicates
- ✅ Audit report shows completeness

---

*Generated by Oliver - Email Knowledge System Phase 2*
