# Auto-Processor Status Card - Deployment Checklist

## Pre-Deployment

- [x] TypeScript compiles without errors
- [x] Production build succeeds (`npm run build`)
- [x] Code committed to Git
- [ ] Database migration reviewed
- [ ] API endpoint tested locally (if Docker available)
- [ ] Component rendering verified

## Database Migration

### Step 1: Apply Migration

**Production:**
```bash
npx supabase db push
```

**Or manually run:**
```sql
-- From: supabase/migrations/20260406_auto_processor_state.sql
CREATE TABLE IF NOT EXISTS auto_processor_state (
  id BIGSERIAL PRIMARY KEY,
  last_check TIMESTAMPTZ NOT NULL,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auto_processor_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view auto processor state"
  ON auto_processor_state FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role can manage auto processor state"
  ON auto_processor_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_auto_processor_state_last_check 
  ON auto_processor_state(last_check DESC);
```

### Step 2: Verify Table Created

```sql
SELECT COUNT(*) FROM auto_processor_state;
-- Should return 0 (empty table)

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'auto_processor_state';
```

## Application Deployment

### Step 3: Deploy Code

```bash
# Push to GitHub
git push origin main

# Vercel will auto-deploy, or manually:
vercel --prod
```

### Step 4: Verify API Endpoint

After deployment, test the endpoint:

```bash
# Replace with your production URL and admin auth token
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-app.vercel.app/api/admin/auto-processor-status
```

Expected response (initially):
```json
{
  "status": "stopped",
  "lastProcessed": null,
  "minutesSinceLastCheck": null,
  "stats": {
    "emails": { "total": 0, "sent": 0, "received": 0 },
    "transcripts": 0,
    "confidence": { "average": 0, "high": 0, "medium": 0, "low": 0 }
  }
}
```

### Step 5: Visual Verification

1. Log in as admin user
2. Navigate to `/admin/knowledge`
3. Verify Auto-Processor Status Card appears at top
4. Should show "⚫ Stopped" since no heartbeats yet
5. Check console for errors

## Auto-Processor Integration

### Step 6: Update Email Auto-Processor

The email auto-processor needs to be updated to log heartbeats.

**Required environment variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Add to processor code:**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function logHeartbeat(processedCount, errorCount = 0, lastError = null) {
  try {
    const { error } = await supabase
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
  } catch (err) {
    console.error('Heartbeat error:', err);
  }
}

// Call after each processing batch or every 5-10 minutes
await logHeartbeat(state.processedIds.length);
```

### Step 7: Test End-to-End

1. Start the email auto-processor
2. Wait for first heartbeat (should be within 5-10 minutes)
3. Refresh `/admin/knowledge` page
4. Verify status changes from "⚫ Stopped" to "🟢 Healthy"
5. Check that stats populate:
   - Email counts
   - Transcript counts (if any Plaud transcripts)
   - Confidence scores

## Post-Deployment Verification

### Checklist

- [ ] Migration applied successfully
- [ ] Table exists with correct schema
- [ ] RLS policies active
- [ ] API endpoint returns valid response
- [ ] Dashboard card renders without errors
- [ ] Status shows "Stopped" initially (expected)
- [ ] Auto-processor updated with heartbeat logging
- [ ] First heartbeat received
- [ ] Status updates to "Healthy" after heartbeat
- [ ] Stats display correctly
- [ ] Auto-refresh works (30-second polling)

### Monitoring

**Check processor health:**
```sql
SELECT 
  last_check,
  processed_count,
  error_count,
  EXTRACT(EPOCH FROM (NOW() - last_check)) / 60 AS minutes_ago
FROM auto_processor_state
ORDER BY last_check DESC
LIMIT 10;
```

**Expected behavior:**
- New record every 5-10 minutes
- `minutes_ago` should be < 10 for "Healthy" status
- `error_count` should be 0 or very low

## Rollback Plan

If issues occur:

### 1. Remove Component (Quick Fix)
```tsx
// In src/components/admin/knowledge/dashboard.tsx
// Comment out:
// <AutoProcessorStatusCard />
```

### 2. Revert Migration
```sql
DROP TABLE IF EXISTS auto_processor_state CASCADE;
```

### 3. Revert Git Commit
```bash
git revert HEAD
git push origin main
```

## Troubleshooting

### Issue: Card shows "Failed to load status"

**Possible causes:**
- User not logged in → Check auth
- User not admin → Check profiles.role
- API endpoint error → Check server logs

### Issue: Status always "Stopped"

**Possible causes:**
- Auto-processor not logging heartbeats
- Supabase credentials missing
- RLS policy blocking writes

**Debug:**
```sql
-- Check if any records exist
SELECT COUNT(*) FROM auto_processor_state;

-- Check RLS allows service role
SET ROLE service_role;
SELECT * FROM auto_processor_state;
```

### Issue: Stats show 0 despite processing

**Possible causes:**
- `email_processing_log` table empty
- Date filter too restrictive (24h window)
- Wrong source type field

**Debug:**
```sql
-- Check email_processing_log
SELECT COUNT(*), MAX(processed_at) 
FROM email_processing_log
WHERE processed_at >= NOW() - INTERVAL '24 hours';

-- Check for transcripts
SELECT COUNT(*) 
FROM email_processing_log
WHERE plaud_transcript_id IS NOT NULL
  AND processed_at >= NOW() - INTERVAL '24 hours';
```

## Success Metrics

After 24 hours of operation:

- **Uptime**: Status should be "Healthy" >95% of checks
- **Heartbeat frequency**: Record every 5-10 minutes
- **Error rate**: <1% of heartbeats with errors
- **Stats accuracy**: Email counts match processor logs

## Next Steps

1. Monitor for 24-48 hours
2. Gather user feedback
3. Consider enhancements:
   - Historical uptime chart
   - Alert notifications
   - Error log viewer
   - Processing rate metrics

---

**Deployment Date:** _____________

**Deployed By:** _____________

**Notes:**
