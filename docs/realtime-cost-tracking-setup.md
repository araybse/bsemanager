# API Cost Tracking - Complete Fix Guide

## Status: ✅ BOTH ISSUES FIXED

**Last Updated:** 2026-04-06
**Fixed By:** Olivia (audit subagent)

---

## Issue #1: Real-Time Tab Shows $0

### Root Cause
**The migration file was created but NEVER EXECUTED in Supabase.**

Sebastian created the migration file `supabase/migrations/20260406_api_costs_realtime.sql` but did not run it against the production database. The table `api_costs_realtime` did not exist, so all queries returned empty results displaying $0.

### Fix Applied
- Created `api_costs_realtime` table in Supabase
- Added indexes and RLS policies
- Inserted test data for verification

---

## Issue #2: Historical Tab Shows Inaccurate Data

### Root Cause
**The API endpoints queried the WRONG TABLE.**

- **Data was imported to:** `api_costs` (331 records, $1,969.02 total)
- **API was querying:** `api_cost_log` (289 records, ~$1.17 from Sophia only)

### Fix Applied
Updated all historical API endpoints to query `api_costs` instead of `api_cost_log`:
- `/api/costs/summary` ✅
- `/api/costs/trends` ✅
- `/api/costs/stats` ✅
- `/api/costs/recent` ✅

### Historical Data Verification
```
  month   | total_cost | record_count 
----------+------------+--------------
 2026-02  |   $284.51  |     183
 2026-03  |   $566.77  |      81
 2026-04  | $1,117.74  |      67
```

---

## What Was Fixed

1. **Created the `api_costs_realtime` table** in Supabase production
2. **Added indexes** for efficient queries
3. **Set up RLS policies** for security
4. **Inserted initial test data** to verify functionality
5. **Verified logging script** works correctly

## Database Schema

```sql
CREATE TABLE api_costs_realtime (
  id BIGSERIAL PRIMARY KEY,
  session_key TEXT NOT NULL,          -- e.g., 'agent:main:telegram:direct:...'
  session_type TEXT,                  -- 'main' or 'subagent'
  agent_name TEXT,                    -- 'Max', 'Sebastian', 'Olivia', etc.
  model TEXT NOT NULL,                -- e.g., 'anthropic/claude-sonnet-4-5'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4) NOT NULL,
  session_duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  usage_date DATE NOT NULL
);
```

## How to Log Sessions

### Manual Logging via Script

```bash
export SUPABASE_URL="https://lqlyargzteskhsddbjpa.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<key>"

node ~/automation/scripts/log-session-usage.js \
  --session-key="agent:main:telegram:direct:8068519905" \
  --model="claude-sonnet-4-5" \
  --input=150000 \
  --output=15000 \
  --cache-write=5000 \
  --cache-read=50000 \
  --agent="Max" \
  --type="main"
```

### Output

```json
{
  "success": true,
  "session_key": "...",
  "cost_usd": "0.7275",
  "total_tokens": 220000,
  "id": 1
}
```

## Pricing (April 2026)

| Model | Input/1M | Output/1M | Cache Write/1M | Cache Read/1M |
|-------|----------|-----------|----------------|---------------|
| claude-opus-4-5 | $15.00 | $75.00 | $18.75 | $1.50 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-haiku-4-5 | $0.80 | $4.00 | $1.00 | $0.08 |

## Future Automatic Logging

**TODO: OpenClaw Integration**

To automatically log all sessions, a hook needs to be added to OpenClaw. Options:

1. **Post-response webhook** - Log after each response
2. **Session end hook** - Log when session closes
3. **Periodic polling** - Check `session_status` and log periodically

Current workaround: Manual logging via the script after significant sessions.

## API Endpoints

- `GET /api/admin/api-costs-realtime?action=today` - Today's costs
- `GET /api/admin/api-costs-realtime?action=summary` - Monthly summary
- `GET /api/admin/api-costs-realtime?date=2026-04-06` - Specific date

## Verification

```bash
# Check table exists
curl -s "${SUPABASE_URL}/rest/v1/api_costs_realtime?select=count" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | grep content-range

# Expected: content-range: 0-3/4 (or similar with records)
```

## Troubleshooting

### Still showing $0?

1. Check if table exists (query above)
2. Check if today's data exists: `?usage_date=eq.2026-04-06`
3. Check API authentication (needs admin role)
4. Check browser console for fetch errors

### Logging script fails?

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. Check the model name matches pricing table
3. Verify session_key is not null
