# Auto-Processor Status Dashboard Card

## Overview

This feature adds a real-time health monitoring card to the IRIS Knowledge Dashboard (`/admin/knowledge`) showing the status of the email auto-processor.

## Design

### Card Layout
```
┌─────────────────────────────────────────────────┐
│ 📡 Auto-Processor Status                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  🟢 Running Smoothly                            │
│  Last processed: 2 minutes ago                  │
│                                                  │
│  📊 Recent Activity (Last 24 Hours)             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  📧 Emails Processed: 47                        │
│     ↗️ Sent: 18  ↙️ Received: 29               │
│                                                  │
│  🎙️ Meeting Transcripts: 3                     │
│                                                  │
│  🎯 Avg Confidence: 87%                         │
│     High (>80%): 38 | Medium: 7 | Low: 2       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Health States

| State | Icon | Trigger | Color |
|-------|------|---------|-------|
| Healthy | 🟢 | Last processed <10 minutes ago | Green |
| Warning | 🟡 | Last processed 10-30 minutes ago | Yellow |
| Error | 🔴 | Last processed >30 minutes ago OR recent errors | Red |
| Stopped | ⚫ | Process not running | Gray |

## Implementation

### 1. Database Migration

**File:** `supabase/migrations/20260406_auto_processor_state.sql`

Creates the `auto_processor_state` table to track processor heartbeats:

```sql
CREATE TABLE auto_processor_state (
  id BIGSERIAL PRIMARY KEY,
  last_check TIMESTAMP NOT NULL,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**To apply:**
```bash
# Local (requires Docker)
npx supabase db reset --local

# Production
npx supabase db push
```

### 2. Backend API Endpoint

**File:** `src/app/api/admin/auto-processor-status/route.ts`

**Endpoint:** `GET /api/admin/auto-processor-status`

**Auth:** Admin only

**Response:**
```json
{
  "status": "healthy",
  "lastProcessed": "2026-04-06T19:45:00.000Z",
  "minutesSinceLastCheck": 2.5,
  "stats": {
    "emails": {
      "total": 47,
      "sent": 18,
      "received": 29
    },
    "transcripts": 3,
    "confidence": {
      "average": 87,
      "high": 38,
      "medium": 7,
      "low": 2
    }
  }
}
```

**Data Sources:**
- Processor heartbeat: `auto_processor_state` table
- Email stats: `email_processing_log` table (last 24 hours)
- Transcripts: `email_processing_log` where `plaud_transcript_id IS NOT NULL`
- Confidence: Calculated from `confidence` column in `email_processing_log`

### 3. Frontend Component

**File:** `src/components/knowledge/auto-processor-status-card.tsx`

**Features:**
- ✅ Real-time updates (30-second polling via React Query)
- ✅ Loading states with skeleton UI
- ✅ Error handling
- ✅ Responsive design
- ✅ Color-coded health indicators
- ✅ Detailed statistics breakdown

**Usage:**
```tsx
import { AutoProcessorStatusCard } from '@/components/knowledge/auto-processor-status-card';

<AutoProcessorStatusCard />
```

### 4. Integration

**File:** `src/components/admin/knowledge/dashboard.tsx`

Added to the top of the Knowledge Dashboard:

```tsx
export function KnowledgeDashboard() {
  return (
    <div className="space-y-6">
      {/* Auto-Processor Status - Top of page */}
      <AutoProcessorStatusCard />
      
      {/* Existing dashboard content */}
      ...
    </div>
  );
}
```

## Auto-Processor Integration

The email auto-processor needs to log heartbeats to the `auto_processor_state` table.

### Example Integration (Node.js)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function logHeartbeat(processedCount, errorCount = 0, lastError = null) {
  const { data, error } = await supabase
    .from('auto_processor_state')
    .insert({
      last_check: new Date().toISOString(),
      processed_count: processedCount,
      error_count: errorCount,
      last_error: lastError
    });
  
  if (error) {
    console.error('Failed to log heartbeat:', error);
  }
}

// Call this periodically (e.g., every 5 minutes or after each batch)
await logHeartbeat(processedIds.length);
```

### Recommended Heartbeat Frequency

- **Every 5 minutes** during active processing
- **Every 10 minutes** during idle periods
- **Immediately** after errors

## Testing

### Manual Test Script

**File:** `scripts/test-auto-processor-status.mjs`

```bash
node scripts/test-auto-processor-status.mjs
```

This script:
1. Inserts sample heartbeat data
2. Verifies the API endpoint logic
3. Shows what the dashboard will display

### Visual Testing

1. Navigate to `/admin/knowledge`
2. Verify the Auto-Processor Status Card appears at the top
3. Check that it shows:
   - ✅ Health indicator
   - ✅ Last processed timestamp
   - ✅ Email counts (total, sent, received)
   - ✅ Transcript count
   - ✅ Confidence score with breakdown

### Test Different States

```sql
-- Healthy (2 minutes ago)
INSERT INTO auto_processor_state (last_check, processed_count)
VALUES (NOW() - INTERVAL '2 minutes', 47);

-- Warning (15 minutes ago)
INSERT INTO auto_processor_state (last_check, processed_count)
VALUES (NOW() - INTERVAL '15 minutes', 35);

-- Error (45 minutes ago)
INSERT INTO auto_processor_state (last_check, processed_count, error_count, last_error)
VALUES (NOW() - INTERVAL '45 minutes', 20, 3, 'Connection timeout');

-- Stopped (no records)
DELETE FROM auto_processor_state;
```

## Success Criteria

- ✅ Health indicator shows correct status (green/yellow/red/gray)
- ✅ Email counts accurate (sent vs received, last 24h)
- ✅ Meeting transcript count accurate
- ✅ Confidence score calculated correctly
- ✅ Auto-refreshes every 30 seconds
- ✅ Card looks clean and professional
- ✅ Matches IRIS design system colors
- ✅ TypeScript compiles without errors
- ✅ Production build succeeds

## Future Enhancements

1. **Click-through to logs** - Link to detailed processing logs
2. **Error history** - Show recent errors in a tooltip/modal
3. **Performance metrics** - Add processing rate (emails/min)
4. **Alerts** - Email/Slack notifications when status changes
5. **Historical view** - Chart showing uptime over 24h/7d/30d
6. **Processor controls** - Pause/resume buttons (with auth)

## Troubleshooting

### Card shows "Stopped" but processor is running

- Processor is not logging heartbeats to `auto_processor_state`
- Check processor logs for Supabase connection errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set

### API returns 401 Unauthorized

- User is not logged in
- Check auth middleware

### API returns 403 Forbidden

- User role is not 'admin'
- Check `profiles` table for user's role

### Build fails with TypeScript errors

- Ensure all `any` types are properly cast
- Run `npm run build` to verify

## Related Files

- Migration: `supabase/migrations/20260406_auto_processor_state.sql`
- API: `src/app/api/admin/auto-processor-status/route.ts`
- Component: `src/components/knowledge/auto-processor-status-card.tsx`
- Dashboard: `src/components/admin/knowledge/dashboard.tsx`
- Test: `scripts/test-auto-processor-status.mjs`
- Docs: `docs/AUTO_PROCESSOR_STATUS_CARD.md` (this file)
