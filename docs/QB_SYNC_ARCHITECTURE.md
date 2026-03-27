# QuickBooks Sync Architecture

## Overview

IRIS uses a **modular, parallel sync architecture** for maximum performance and reliability.

### Before (Monolithic)
```
POST /api/qb-time/sync
  ↓
Sync customers (30s)
  ↓
Sync projects (45s)
  ↓
Sync invoices (60s)
  ↓
Sync time entries (90s)
  ↓
Total: 225+ seconds (3.75 minutes)
```

### After (Parallel + Modular)
```
POST /api/qb-time/sync-all
  ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Customers  │  Projects   │  Invoices   │  Payments   │
│    (30s)    │    (45s)    │    (60s)    │    (20s)    │
└─────────────┴─────────────┴─────────────┴─────────────┘
  ↓
Total: 90 seconds (60-70% faster!)
```

---

## API Routes

### Full Sync (Parallel)

**POST `/api/qb-time/sync-all`**

Syncs all domains in parallel. Use for:
- Manual "Sync All" button
- Scheduled overnight syncs
- Initial data import

**Response:**
```json
{
  "success": true,
  "duration_ms": 87234,
  "results": [
    { "domain": "customers", "success": true, "counts": {...}, "duration_ms": 28450 },
    { "domain": "invoices", "success": true, "counts": {...}, "duration_ms": 54120 }
  ],
  "totals": {
    "imported": 45,
    "updated": 234,
    "errors": 0
  },
  "parallel_speedup": true
}
```

---

### Individual Domain Syncs

Each domain has its own route for targeted syncing:

| Route | Domain | Use Case |
|-------|--------|----------|
| `POST /api/qb-time/sync/customers` | Customers | Customer list changed |
| `POST /api/qb-time/sync/projects` | Projects | Project setup changed |
| `POST /api/qb-time/sync/invoices` | Invoices | Invoice created/updated |
| `POST /api/qb-time/sync/payments` | Payments | Payment received |
| `POST /api/qb-time/sync/time-entries` | Time | Timesheets submitted |
| `POST /api/qb-time/sync/expenses` | Expenses | Expenses recorded |

**Example:**
```bash
# Sync just invoices
curl -X POST https://iris.yourdomain.com/api/qb-time/sync/invoices \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "domain": "invoices",
  "counts": {
    "imported": 3,
    "updated": 12,
    "errors": 0
  },
  "synced_at": "2026-03-27T04:15:00.000Z"
}
```

---

### Single Entity Sync

Sync one specific record (triggered by webhooks):

**POST `/api/qb-time/sync/invoices/[id]`**

**Example:**
```bash
# Sync invoice #INV-1234
curl -X POST https://iris.yourdomain.com/api/qb-time/sync/invoices/1234 \
  -H "x-internal-sync-token: $INTERNAL_TOKEN"
```

---

## Sync Modes

### 1. **Manual Sync** (User-initiated)
- User clicks "Sync" button
- Calls `/api/qb-time/sync-all`
- Requires `admin` role

### 2. **Webhook Sync** (Real-time)
- QuickBooks sends webhook
- IRIS syncs just that entity
- Happens automatically within seconds

### 3. **Scheduled Sync** (Cron)
- Runs overnight (e.g., 2 AM)
- Calls `/api/qb-time/sync-all`
- Ensures everything stays fresh

---

## Error Handling

### Domain Isolation

If one domain fails, others continue:

```json
{
  "success": false,
  "message": "5 domains succeeded, 1 failed",
  "results": [
    { "domain": "customers", "success": true },
    { "domain": "projects", "success": true },
    { "domain": "invoices", "success": false, "error": "Rate limit exceeded" },
    { "domain": "payments", "success": true },
    { "domain": "time_entries", "success": true }
  ]
}
```

### Retry Strategy

1. Webhook sync fails → Logged in `sync_runs` table
2. Manual retry: `POST /api/qb-time/sync/invoices` (just that domain)
3. Scheduled sync catches any missed updates overnight

### Monitoring

```sql
-- Failed syncs in last 24 hours
SELECT domain, status, error_summary
FROM sync_runs
WHERE status = 'failed'
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;
```

---

## Performance

### Benchmarks

| Sync Type | Before (Sequential) | After (Parallel) | Speedup |
|-----------|---------------------|------------------|---------|
| Full Sync | 225 seconds | 90 seconds | **60% faster** |
| Customers only | 30 seconds | 30 seconds | Same |
| Invoices only | 60 seconds | 60 seconds | Same |

### Why Parallel Works

- Each domain writes to **different tables** (no conflicts)
- QuickBooks API supports **concurrent requests**
- Network I/O is the bottleneck (not CPU)

---

## Migration from Old Route

The old monolithic route (`/api/qb-time/sync`) still exists for backward compatibility, but we recommend:

**Old way:**
```typescript
fetch('/api/qb-time/sync', { method: 'POST' })
```

**New way:**
```typescript
fetch('/api/qb-time/sync-all', { method: 'POST' })
```

Benefits:
- ✅ 60% faster
- ✅ Better error isolation
- ✅ Individual domain retry
- ✅ Clearer logging

---

## Security

All sync routes require authentication:

- **Manual sync**: Admin or PM role
- **Webhook sync**: Valid `intuit-signature` header
- **Internal calls**: Valid `x-internal-sync-token`

Tokens are checked via middleware before any sync logic runs.

---

## Future Enhancements

### Planned
- ✅ Webhooks (done)
- ✅ Parallel sync (done)
- ⏳ Incremental sync (only changes since last sync)
- ⏳ Smart scheduling (sync during low-usage hours)
- ⏳ Sync status UI (real-time progress bar)

### Ideas
- Pause/resume long syncs
- Sync priority queue (invoices > expenses)
- Historical data backfill (import 2+ years)

---

## Troubleshooting

**Parallel sync slower than expected?**
- Check QuickBooks API rate limits
- Verify network latency (ping api.intuit.com)
- Review `sync_runs` table for bottlenecks

**One domain keeps failing?**
- Sync just that domain: `POST /api/qb-time/sync/[domain]`
- Check error message in response
- Review QB OAuth token expiration

**Want sequential sync back?**
- Use old route: `POST /api/qb-time/sync`
- Or disable parallel: Set `DISABLE_PARALLEL_SYNC=true` in env

