# API Cost Tracking System

**Real-time monitoring of OpenClaw session token usage and API costs**

Created: April 6, 2026  
Last Updated: April 6, 2026

---

## Overview

The API Cost Tracking System logs every OpenClaw session's token usage to IRIS and displays it in a live dashboard. This enables real-time cost monitoring, budget alerts, and historical analysis.

### Key Features

✅ **Real-time logging** - Every session is logged automatically  
✅ **Live dashboard** - Auto-refreshing every 30 seconds  
✅ **Budget alerts** - Visual warnings when spending exceeds thresholds  
✅ **Agent breakdown** - See which agents (Max, Sebastian, Olivia) are using the most tokens  
✅ **Model breakdown** - Track costs by Claude model  
✅ **Hourly breakdown** - See spending patterns throughout the day  
✅ **Historical data** - Combined with CSV backfill data for long-term trends  

---

## Architecture

### Components

1. **Database Table**: `api_costs_realtime` - Stores session logs
2. **Logging Script**: `~/automation/scripts/log-session-usage.js` - Logs sessions to database
3. **API Endpoints**: `/api/admin/api-costs-realtime` - Serves data to dashboard
4. **Dashboard**: Real-Time tab in Admin → Costs page

### Data Flow

```
OpenClaw Session
    ↓
session_status (extract token counts)
    ↓
log-session-usage.js (calculate cost)
    ↓
Supabase (api_costs_realtime table)
    ↓
API endpoint (aggregate data)
    ↓
Dashboard (display charts)
```

---

## Usage

### Viewing the Dashboard

1. Navigate to **Admin → Costs** in IRIS
2. Click the **Real-Time** tab
3. Dashboard auto-refreshes every 30 seconds

### Dashboard Sections

#### 1. Today's Spending Widget
- **Large number**: Current day's total cost
- **Budget progress bar**: Visual indicator vs $150 daily budget
- **Alert badges**: Warning when over budget or at alert level
- **Quick stats**: Session count, total tokens, average per session

#### 2. Month Summary
- **Month Total**: Current month's cumulative cost
- **Daily Average**: Average daily spend this month
- **Projected Month**: Estimated month-end total (avg × 30 days)

#### 3. Hourly Breakdown Chart
- Line chart showing spending by hour of day
- Helps identify peak usage times

#### 4. By Agent Chart
- Pie chart showing cost breakdown by agent
- See which agents are using the most tokens

#### 5. By Model Chart
- Bar chart showing cost breakdown by Claude model
- Compare Sonnet vs Opus vs Haiku usage

#### 6. Live Activity Feed
- Recent 20 sessions
- Shows: Time, Agent, Type, Model, Tokens, Cost
- Auto-refreshing

---

## Budget Configuration

### Current Settings

- **Daily Budget**: $150
- **Alert Threshold**: $200

### How to Update

Edit `~/.openclaw/workspace/bsemanager/src/app/(authenticated)/admin/costs/page.tsx`:

```typescript
const DAILY_BUDGET = 150;        // Change this
const DAILY_ALERT_THRESHOLD = 200; // Change this
```

### Budget Alerts

- **Green**: Under budget
- **Yellow**: Over budget (> $150)
- **Red**: Alert level (> $200)

---

## Logging Sessions

### Manual Logging

Log a session manually using the script:

```bash
node ~/automation/scripts/log-session-usage.js \
  --session-key="agent:main:telegram:8068519905" \
  --model="claude-sonnet-4-5" \
  --input=10000 \
  --output=5000 \
  --cache-write=2000 \
  --cache-read=1000 \
  --agent="Max" \
  --type="main" \
  --duration=15000
```

### Via Environment Variables

```bash
export SESSION_KEY="agent:main:..."
export MODEL="claude-sonnet-4-5"
export INPUT_TOKENS=10000
export OUTPUT_TOKENS=5000
export CACHE_WRITE_TOKENS=2000
export CACHE_READ_TOKENS=1000
export AGENT_NAME="Max"
export SESSION_TYPE="main"
export SESSION_DURATION_MS=15000

node ~/automation/scripts/log-session-usage.js
```

### Response Format

```json
{
  "success": true,
  "session_key": "agent:main:telegram:8068519905",
  "cost_usd": "0.0850",
  "total_tokens": 18000,
  "id": 123
}
```

---

## Pricing Table

**Updated: April 2026** (Prices per 1M tokens)

| Model | Input | Output | Cache Write | Cache Read |
|-------|-------|--------|-------------|------------|
| claude-opus-4 | $15.00 | $75.00 | $18.75 | $1.50 |
| claude-opus-4-5 | $15.00 | $75.00 | $18.75 | $1.50 |
| claude-opus-4-6 | $15.00 | $75.00 | $18.75 | $1.50 |
| claude-sonnet-4 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-haiku-3 | $0.25 | $1.25 | $0.30 | $0.03 |
| claude-haiku-4-5 | $0.80 | $4.00 | $1.00 | $0.08 |

### Updating Pricing

When Claude changes pricing, update the table in:

```
~/automation/scripts/log-session-usage.js
```

Look for the `PRICING` constant at the top of the file.

---

## Querying Data Manually

### Using Supabase SQL Editor

```sql
-- Today's total cost
SELECT 
  SUM(estimated_cost_usd) as total_cost,
  COUNT(*) as session_count
FROM api_costs_realtime
WHERE usage_date = CURRENT_DATE;

-- Cost by agent today
SELECT 
  agent_name,
  SUM(estimated_cost_usd) as cost,
  SUM(total_tokens) as tokens,
  COUNT(*) as sessions
FROM api_costs_realtime
WHERE usage_date = CURRENT_DATE
GROUP BY agent_name
ORDER BY cost DESC;

-- Hourly breakdown
SELECT 
  EXTRACT(HOUR FROM created_at) as hour,
  SUM(estimated_cost_usd) as cost
FROM api_costs_realtime
WHERE usage_date = CURRENT_DATE
GROUP BY hour
ORDER BY hour;

-- Top models this month
SELECT 
  model,
  SUM(estimated_cost_usd) as total_cost,
  COUNT(*) as sessions
FROM api_costs_realtime
WHERE usage_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY model
ORDER BY total_cost DESC;
```

### Using Node.js

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get today's costs
const { data, error } = await supabase
  .from('api_costs_realtime')
  .select('*')
  .eq('usage_date', new Date().toISOString().split('T')[0]);

console.log('Total cost:', data.reduce((sum, r) => sum + parseFloat(r.estimated_cost_usd), 0));
```

---

## OpenClaw Integration

### Phase 2 (To Be Implemented)

Currently, sessions must be logged manually. Future work will integrate directly with OpenClaw to log automatically.

#### Planned Integration Points

1. **Max's Sessions** (Main Agent)
   - Hook into response completion
   - Extract token counts from `session_status`
   - Call `log-session-usage.js` automatically
   - Track session keys to avoid double-logging

2. **Sub-Agent Sessions**
   - Hook into sub-agent completion events
   - Extract token usage from completion stats
   - Log with agent name (Sebastian, Olivia, Oliver, etc.)

#### Manual Configuration Required

Austin will need to:

1. Add post-response hook to OpenClaw config
2. Set environment variables for Supabase access
3. Configure session tracking to avoid duplicates

**Example Hook** (conceptual):

```javascript
// In OpenClaw config or plugin
async function onResponseComplete(session) {
  const status = await getSessionStatus(session.key);
  
  await exec(`node ~/automation/scripts/log-session-usage.js \
    --session-key="${session.key}" \
    --model="${session.model}" \
    --input=${status.inputTokens} \
    --output=${status.outputTokens} \
    --cache-write=${status.cacheWriteTokens} \
    --cache-read=${status.cacheReadTokens} \
    --agent="${session.agentName}" \
    --type="${session.type}" \
    --duration=${status.duration}`);
}
```

---

## Troubleshooting

### Problem: Sessions not appearing in dashboard

**Check:**
1. Is the database table created? Run migration:
   ```bash
   cd ~/.openclaw/workspace/bsemanager
   npx supabase db push
   ```

2. Are Supabase env vars set?
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

3. Test logging manually:
   ```bash
   node ~/automation/scripts/log-session-usage.js --help
   ```

### Problem: "Unknown model" warning

**Solution:** Update pricing table in `log-session-usage.js` with the new model.

### Problem: Dashboard not auto-refreshing

**Check:**
1. Verify `refetchInterval: 30000` is set in query config
2. Check browser console for errors
3. Ensure API endpoint is responding (check Network tab)

### Problem: Cost calculations seem wrong

**Check:**
1. Verify pricing table matches current Claude API prices
2. Check token counts in database match actual usage
3. Test cost calculation:
   ```javascript
   const { calculateCost } = require('~/automation/scripts/log-session-usage.js');
   const cost = calculateCost('claude-sonnet-4-5', 10000, 5000, 2000, 1000);
   console.log(cost); // Should be ~0.085
   ```

### Problem: RLS policy denying access

**Solution:** Ensure user has `admin` role in `profiles` table:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'your-user-id';
```

---

## Database Schema

### Table: `api_costs_realtime`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `session_key` | TEXT | OpenClaw session identifier |
| `session_type` | TEXT | 'main', 'subagent' |
| `agent_name` | TEXT | 'Max', 'Sebastian', 'Olivia', etc. |
| `model` | TEXT | Claude model name |
| `input_tokens` | INTEGER | Input token count |
| `output_tokens` | INTEGER | Output token count |
| `cache_write_tokens` | INTEGER | Cache write token count |
| `cache_read_tokens` | INTEGER | Cache read token count |
| `total_tokens` | INTEGER | Sum of all token types |
| `estimated_cost_usd` | DECIMAL(10,4) | Calculated cost in USD |
| `session_duration_ms` | INTEGER | Session duration in milliseconds |
| `created_at` | TIMESTAMP | When record was created |
| `usage_date` | DATE | Date for easy querying |

### Indexes

- `idx_api_costs_realtime_date` - Query by date
- `idx_api_costs_realtime_model` - Query by model
- `idx_api_costs_realtime_agent` - Query by agent
- `idx_api_costs_realtime_session` - Query by session key
- `idx_api_costs_realtime_created` - Query by creation time

---

## Future Enhancements

### Planned Features

- [ ] **Email/SMS Alerts** - Notify when budget exceeded
- [ ] **Weekly Reports** - Automated summary emails
- [ ] **Cost Forecasting** - Predict month-end total based on trends
- [ ] **Cost per Project** - Tag sessions with project IDs
- [ ] **Comparison Views** - Compare today vs yesterday, this week vs last week
- [ ] **Export to CSV** - Download real-time data
- [ ] **Custom Budget Rules** - Different budgets for different agents/models
- [ ] **Usage Anomaly Detection** - Alert on unusual spending spikes

### Contributing

When adding features:
1. Update this documentation
2. Add tests in `~/automation/scripts/test-cost-tracking.js`
3. Update pricing table when Claude changes prices
4. Keep dashboard performant (use pagination for large datasets)

---

## API Reference

### Endpoints

#### GET `/api/admin/api-costs-realtime`

**Query Parameters:**
- `action` (optional): 'query', 'today', or 'summary'
- `date` (optional): Date in YYYY-MM-DD format

**Examples:**

```bash
# Today's costs
curl "https://iris.yourdomain.com/api/admin/api-costs-realtime?action=today"

# Specific date
curl "https://iris.yourdomain.com/api/admin/api-costs-realtime?date=2026-04-06"

# Month summary
curl "https://iris.yourdomain.com/api/admin/api-costs-realtime?action=summary"
```

**Response Format:**

```json
{
  "date": "2026-04-06",
  "total_cost": 45.67,
  "total_tokens": 1234567,
  "session_count": 12,
  "by_agent": {
    "Max": { "cost": 25.00, "tokens": 800000 },
    "Sebastian": { "cost": 10.00, "tokens": 250000 }
  },
  "by_model": {
    "claude-sonnet-4-5": { "cost": 35.00, "tokens": 1000000 }
  },
  "hourly_breakdown": [
    { "hour": "08:00", "cost": 5.00 },
    { "hour": "09:00", "cost": 12.00 }
  ],
  "sessions": [
    {
      "id": 123,
      "session_key": "agent:main:...",
      "agent_name": "Max",
      "model": "claude-sonnet-4-5",
      "total_tokens": 15000,
      "estimated_cost_usd": "0.0750",
      "created_at": "2026-04-06T10:30:00Z"
    }
  ]
}
```

---

## Maintenance

### Daily Tasks
- Monitor dashboard for spending anomalies
- Check for failed logging attempts
- Verify auto-refresh is working

### Weekly Tasks
- Review top agents/models
- Compare week-over-week trends
- Check for any database performance issues

### Monthly Tasks
- Update pricing table if Claude announces changes
- Review and adjust budget thresholds
- Archive old data if table grows too large (>1M rows)

### Database Maintenance

```sql
-- Archive records older than 90 days
CREATE TABLE api_costs_realtime_archive AS 
SELECT * FROM api_costs_realtime 
WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';

DELETE FROM api_costs_realtime 
WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';

-- Vacuum to reclaim space
VACUUM ANALYZE api_costs_realtime;
```

---

## Support

**Questions?** Check:
1. This documentation
2. Database logs: `supabase logs`
3. Script logs: `node ~/automation/scripts/log-session-usage.js --help`
4. API responses: Browser DevTools → Network tab

**Found a bug?** Document:
1. What you expected to happen
2. What actually happened
3. Error messages or logs
4. Steps to reproduce

---

*Last Updated: April 6, 2026 by Sebastian (Subagent)*
