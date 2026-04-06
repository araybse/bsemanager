# Auto-Processor Status Card - Quick Start Guide

**⚡ Fast deployment guide for the Auto-Processor Health Dashboard Card**

---

## 🚀 Deploy in 3 Steps

### Step 1: Apply Database Migration (2 minutes)

```bash
cd ~/.openclaw/workspace/bsemanager

# Push migration to production
npx supabase db push
```

**Or manually via SQL:**
```sql
-- Copy contents of: supabase/migrations/20260406_auto_processor_state.sql
-- Paste and run in Supabase SQL Editor
```

**Verify:**
```sql
SELECT COUNT(*) FROM auto_processor_state;
-- Should return 0 (empty table ready to receive data)
```

### Step 2: Deploy Code (5 minutes)

```bash
# Already committed - just push
git push origin main

# Vercel auto-deploys from main branch
# Or manually: vercel --prod
```

**Verify deployment:**
1. Visit https://your-app.vercel.app/admin/knowledge
2. Log in as admin
3. Look for "📡 Auto-Processor Status" card at top
4. Should show "⚫ Stopped" (expected - no heartbeats yet)

### Step 3: Update Email Auto-Processor (10 minutes)

Add heartbeat logging to your email processing script:

```javascript
// At the top of your processor file
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add this function
async function logHeartbeat(processedCount, errorCount = 0, lastError = null) {
  try {
    await supabase.from('auto_processor_state').insert({
      last_check: new Date().toISOString(),
      processed_count: processedCount,
      error_count: errorCount,
      last_error: lastError
    });
  } catch (err) {
    console.error('Heartbeat error:', err);
  }
}

// In your processing loop - call every 5-10 minutes
await logHeartbeat(state.processedIds.length);
```

**Restart your processor** and wait for the first heartbeat.

---

## ✅ Verification Checklist

After 10 minutes:

- [ ] `/admin/knowledge` page loads
- [ ] Auto-Processor Status card visible at top
- [ ] Status shows "🟢 Running Smoothly" (not "Stopped")
- [ ] "Last processed" shows recent time (<10 min)
- [ ] Email counts populate (if emails processed in last 24h)
- [ ] Card auto-refreshes every 30 seconds

---

## 🔍 Quick Troubleshooting

### Card shows "⚫ Stopped" after processor started

**Check:**
```sql
-- Any heartbeats received?
SELECT * FROM auto_processor_state ORDER BY last_check DESC LIMIT 5;
```

**If empty:**
- Processor not calling `logHeartbeat()`
- Check processor logs for Supabase errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set

### Card shows "Failed to load status"

**Check browser console:**
- 401 error → Not logged in
- 403 error → User not admin
- 500 error → Check server logs

### Stats show 0 despite processing

**Check data source:**
```sql
-- Recent emails in processing log?
SELECT COUNT(*), MAX(processed_at) 
FROM email_processing_log
WHERE processed_at >= NOW() - INTERVAL '24 hours';
```

**If 0:** The processor isn't writing to `email_processing_log` yet (may be writing to different table)

---

## 📊 What You'll See

### Initial State (No Heartbeats)
```
┌─────────────────────────────────────┐
│ 📡 Auto-Processor Status            │
├─────────────────────────────────────┤
│ ⚫ Stopped                           │
│ Last processed: Never               │
│ ...                                  │
└─────────────────────────────────────┘
```

### After First Heartbeat
```
┌─────────────────────────────────────┐
│ 📡 Auto-Processor Status            │
├─────────────────────────────────────┤
│ 🟢 Running Smoothly                 │
│ Last processed: 2 minutes ago       │
│ 📧 Emails Processed: 47             │
│ 🎙️ Meeting Transcripts: 3          │
│ 🎯 Avg Confidence: 87%              │
└─────────────────────────────────────┘
```

---

## 📚 Full Documentation

- **Implementation Details:** `docs/AUTO_PROCESSOR_STATUS_CARD.md`
- **Deployment Checklist:** `DEPLOYMENT_CHECKLIST_AUTO_PROCESSOR.md`
- **Test Script:** `scripts/test-auto-processor-status.mjs`
- **Visual Design:** `AUTO_PROCESSOR_CARD_VISUAL.txt`

---

## 🆘 Need Help?

**Database issue?**
```bash
node scripts/test-auto-processor-status.mjs
```

**API issue?**
```bash
# Check API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-app.vercel.app/api/admin/auto-processor-status
```

**Component issue?**
- Check browser console
- Verify `/admin/knowledge` page loads
- Check React Query dev tools

---

## 🎉 Done!

Your Auto-Processor Status Card is now live and monitoring!

**Expected behavior:**
- ✅ New heartbeat every 5-10 minutes
- ✅ Status stays "🟢 Healthy" during normal operation
- ✅ Stats update as emails are processed
- ✅ Card refreshes automatically every 30 seconds

**Next steps:**
- Monitor for 24h to verify stability
- Check stats accuracy vs processor logs
- Consider adding alerts for "🔴 Error" state
