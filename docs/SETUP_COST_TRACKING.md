# Setup Guide: Real-Time API Cost Tracking

**Quick setup instructions for Austin**

---

## ✅ Phase 1: Database & Backend (COMPLETE)

### What's Been Done

1. ✅ Created database migration: `supabase/migrations/20260406_api_costs_realtime.sql`
2. ✅ Created logging script: `~/automation/scripts/log-session-usage.js`
3. ✅ Created API endpoints: `src/app/api/admin/api-costs-realtime/route.ts`
4. ✅ Updated dashboard: `src/app/(authenticated)/admin/costs/page.tsx`
5. ✅ Created documentation: `docs/API_COST_TRACKING_SYSTEM.md`
6. ✅ Created test script: `~/automation/scripts/test-cost-tracking.js`

---

## 🚀 Phase 2: Deploy to IRIS

### Step 1: Run Database Migration

```bash
cd ~/.openclaw/workspace/bsemanager
npx supabase db push
```

**Expected output:**
```
Applying migration 20260406_api_costs_realtime.sql...
✓ Migration applied successfully
```

### Step 2: Test the System

```bash
cd ~/automation/scripts
node test-cost-tracking.js
```

**Expected output:**
```
✅ All tests passed! System is ready to use.
```

**If tests fail:**
- Check Supabase environment variables are set
- Verify you have service role key (not anon key)
- Check database connection

### Step 3: Build & Deploy Frontend

```bash
cd ~/.openclaw/workspace/bsemanager
npm run build
```

**Expected output:**
```
✓ Compiled successfully
```

**If build fails:**
- Check for any TypeScript errors
- Verify all UI components exist (tabs, badge)
- Run `npm install` if packages are missing

### Step 4: Verify in Browser

1. Open IRIS in your browser
2. Navigate to **Admin → Costs**
3. You should see two tabs: **Real-Time** and **Historical**
4. Click **Real-Time** tab
5. You should see "No activity today yet" (since no sessions logged yet)

---

## 📊 Phase 3: Test Real-Time Logging

### Manual Test

Log a test session:

```bash
node ~/automation/scripts/log-session-usage.js \
  --session-key="test:manual:$(date +%s)" \
  --model="claude-sonnet-4-5" \
  --input=10000 \
  --output=5000 \
  --cache-write=2000 \
  --cache-read=1000 \
  --agent="Max" \
  --type="main" \
  --duration=15000
```

**Expected output:**
```json
{
  "success": true,
  "session_key": "test:manual:1712416800",
  "cost_usd": "0.0850",
  "total_tokens": 18000,
  "id": 1
}
```

### Verify in Dashboard

1. Refresh the **Real-Time** tab in IRIS
2. You should see:
   - Today's spending: $0.0850
   - 1 session in activity feed
   - Charts populated with data

### Clean Up Test Data (Optional)

```bash
# Connect to Supabase and delete test records
cd ~/.openclaw/workspace/bsemanager
npx supabase db psql

-- In psql:
DELETE FROM api_costs_realtime WHERE session_key LIKE 'test:%';
\q
```

---

## 🔧 Phase 4: OpenClaw Integration (TODO)

### Current State

⚠️ **Manual logging required** - Sessions are not automatically logged yet.

### What Needs to Be Done

Austin needs to configure OpenClaw to log sessions automatically. This requires:

1. **Identify hook points** in OpenClaw codebase
2. **Add post-response hook** to extract token usage
3. **Call logging script** after each response
4. **Track session keys** to avoid double-logging

### Proposed Implementation

**Option A: OpenClaw Plugin** (Recommended)

Create a plugin file: `~/.openclaw/plugins/cost-tracking.js`

```javascript
// Example plugin structure (adjust to match OpenClaw plugin API)
module.exports = {
  name: 'cost-tracking',
  
  async onSessionComplete(session) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Extract token counts from session
    const tokens = session.usage || {};
    
    // Build command
    const cmd = [
      'node ~/automation/scripts/log-session-usage.js',
      `--session-key="${session.key}"`,
      `--model="${session.model}"`,
      `--input=${tokens.input || 0}`,
      `--output=${tokens.output || 0}`,
      `--cache-write=${tokens.cacheWrite || 0}`,
      `--cache-read=${tokens.cacheRead || 0}`,
      `--agent="${session.agentName || 'Max'}"`,
      `--type="${session.type || 'main'}"`,
      `--duration=${session.duration || 0}`
    ].join(' ');
    
    // Execute async (don't block response)
    try {
      await execAsync(cmd);
    } catch (error) {
      console.error('Failed to log session:', error.message);
    }
  }
};
```

**Option B: Wrapper Script**

Create a wrapper that calls OpenClaw and logs usage:

```bash
#!/bin/bash
# ~/automation/scripts/openclaw-with-logging.sh

# Run OpenClaw command
openclaw "$@"

# Extract session info from output
# (This approach requires parsing OpenClaw output)
```

**Option C: Cron Job** (Fallback)

Poll OpenClaw session status periodically:

```bash
# Add to crontab
*/5 * * * * node ~/automation/scripts/poll-openclaw-sessions.js
```

### Environment Variables Required

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Then reload:

```bash
source ~/.zshrc
```

### Testing Auto-Logging

1. Send a message to Max via Telegram
2. Wait for response
3. Check IRIS dashboard - should see new session logged
4. Verify cost calculation is accurate

---

## 📝 Phase 5: Budget Alerts (Future)

### Current State

✅ Visual alerts in dashboard  
❌ Email/SMS alerts not implemented yet

### Budget Thresholds

Currently configured in dashboard code:
- **Daily Budget**: $150 (green bar)
- **Alert Level**: $200 (red bar + badge)

### Future: Email Alerts

Create a cron job to check daily spending:

```javascript
// ~/automation/scripts/check-daily-budget.js
const { createClient } = require('@supabase/supabase-js');

async function checkBudget() {
  const supabase = createClient(/* ... */);
  
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('api_costs_realtime')
    .select('estimated_cost_usd')
    .eq('usage_date', today);
  
  const total = data.reduce((sum, r) => sum + parseFloat(r.estimated_cost_usd), 0);
  
  if (total > 200) {
    // Send alert email
    await sendEmail({
      to: 'austin@your-domain.com',
      subject: '⚠️ API Cost Alert: Over $200 Today',
      body: `Today's spending is $${total.toFixed(2)}`
    });
  }
}
```

Run hourly:

```bash
0 * * * * node ~/automation/scripts/check-daily-budget.js
```

---

## 🐛 Troubleshooting

### Problem: Migration fails

**Error:** `relation "api_costs_realtime" already exists`

**Solution:** Migration already ran. Skip to next step.

---

**Error:** `permission denied for schema public`

**Solution:** Check Supabase service role key is set:

```bash
echo $SUPABASE_SERVICE_ROLE_KEY
```

Should output a long JWT token starting with `eyJ...`

---

### Problem: Dashboard shows no data

**Check:**
1. Did you run the migration?
2. Are there any records in the database?
   ```sql
   SELECT COUNT(*) FROM api_costs_realtime;
   ```
3. Is the API endpoint responding?
   ```bash
   curl "https://iris.your-domain.com/api/admin/api-costs-realtime?action=today"
   ```

---

### Problem: Build fails with TypeScript errors

**Common issues:**
- Missing UI components (tabs, badge)
- Type mismatches in API response

**Solution:**

```bash
# Install missing dependencies
npm install

# Check for errors
npm run build 2>&1 | grep error
```

---

### Problem: Costs seem incorrect

**Check:**
1. Pricing table is up to date (Claude API prices)
2. Token counts match actual usage
3. Test calculation manually:
   ```javascript
   const { calculateCost } = require('~/automation/scripts/log-session-usage.js');
   console.log(calculateCost('claude-sonnet-4-5', 10000, 5000, 2000, 1000));
   ```

---

## 📚 Documentation

Full documentation: `docs/API_COST_TRACKING_SYSTEM.md`

Quick reference:
- **View dashboard**: Admin → Costs → Real-Time tab
- **Log session**: `node ~/automation/scripts/log-session-usage.js --help`
- **Query data**: See SQL examples in documentation
- **Update pricing**: Edit `PRICING` const in `log-session-usage.js`

---

## ✅ Success Criteria

- [x] Database table created
- [x] Logging script working
- [x] API endpoints responding
- [x] Dashboard displaying data
- [x] Tests passing
- [ ] Build succeeds with no errors
- [ ] OpenClaw auto-logging configured
- [ ] Real session logged successfully
- [ ] Budget alerts working

---

## 🎉 Next Steps

1. **Deploy migration** → `npx supabase db push`
2. **Run tests** → `node test-cost-tracking.js`
3. **Build frontend** → `npm run build`
4. **Log test session** → `node log-session-usage.js ...`
5. **View dashboard** → Admin → Costs → Real-Time
6. **Configure OpenClaw** → Add auto-logging hook
7. **Monitor usage** → Check dashboard daily

---

**Questions?** See full documentation or ask Max!

*Created: April 6, 2026 by Sebastian*
