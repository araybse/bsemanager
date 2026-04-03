# QuickBooks Auto-Sync Configuration

## Overview
IRIS automatically syncs with QuickBooks every 15 minutes to keep financial data up-to-date.

## What Gets Synced

### Every 15 Minutes (Automated)
1. **QB Time Data** (via `/api/qb-time/sync`)
   - Customers
   - Projects
   - Invoices
   - Time Entries
   - Payments
   - Project Expenses
   - Contract Labor

2. **Current Month + Previous Month P&L** (via `/api/accounting/profit-loss/sync`)
   - Cash basis
   - **Why previous month?** Catches late categorizations and expense matches made after month-end
   - All income and expense accounts
   - Stored in `accounting_snapshots` table

3. **Current Month + Previous Month Balance Sheet** (via `/api/accounting/balance-sheet/sync`)
   - Accrual basis
   - Month-end snapshots for both months
   - All asset, liability, and equity accounts
   - Stored in `accounting_snapshots` table

## How It Works

### Vercel Cron Job
The auto-sync is configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/qb-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Schedule**: `*/15 * * * *` = Every 15 minutes, 24/7

### Cron Endpoint
**File**: `src/app/api/cron/qb-sync/route.ts`

**Authentication**: Requires `CRON_SECRET` environment variable
- Set in Vercel → Project Settings → Environment Variables
- Header: `Authorization: Bearer {CRON_SECRET}`

### Execution Log
All cron runs are logged in the `cron_runs` table:
- `job_name`: 'qb-sync'
- `status`: 'success', 'failed', or 'partial'
- `results`: JSON with sync results from each domain
- `created_at`: Timestamp of execution

## Manual Sync
You can also trigger manual syncs via the IRIS UI:
- **Settings → Accounting Data → Sync Now** - Syncs current month P&L and Balance Sheet
- **Settings → QuickBooks Data → Sync Now** - Syncs all QB Time data

## Monitoring

### View Sync Status
1. Go to Settings → System
2. Check "Last Sync" timestamps
3. Review sync run history in `cron_runs` table (admin only)

### Check Logs
- Vercel Dashboard → Project → Logs
- Filter by "Cron QB Sync" to see execution logs
- Look for "✅" (success) or "❌" (error) indicators

## Troubleshooting

### Sync Not Running
1. **Check Vercel Cron Status**:
   - Go to Vercel Dashboard → Project → Cron Jobs
   - Verify the job is enabled and shows recent executions

2. **Verify CRON_SECRET**:
   - Must be set in Vercel environment variables
   - Should be a random 32+ character string

3. **Check QB Connection**:
   - Go to Settings → QuickBooks
   - Verify connection status is "Connected"
   - Reconnect if needed

### Sync Failing
1. **Check cron_runs table**:
   ```sql
   SELECT * FROM cron_runs 
   WHERE job_name = 'qb-sync' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **Common Issues**:
   - **QB token expired**: Reconnect in Settings → QuickBooks
   - **Rate limit**: QB API has limits (Vercel Pro reduces frequency if hit)
   - **Network error**: Retry will happen in 15 minutes

### Historical Data Not Syncing
- Auto-sync syncs **current month + previous month**
- **Why?** Late categorizations and expense matches often happen after month-end
  - Example: March transaction comes in on 3/31, you categorize it on 4/2
  - Auto-sync will re-sync March to pick up the new category
- To sync older historical months:
  1. Go to Settings → Accounting Data
  2. Select date range
  3. Click "Sync Historical Data"

## Performance

### Resource Usage
- **Duration**: ~30-60 seconds per sync (depends on data volume)
- **API Calls**: ~50-100 QB API calls per sync
- **Data Transfer**: ~1-5 MB per sync

### Cost
- Vercel Cron: Free on Pro plan (up to 1,000,000 executions/month)
- QuickBooks API: No cost (included with QB subscription)

## Best Practices

1. **Monitor First Week**: Check logs daily after setup to ensure smooth operation
2. **Set Alerts**: Configure alerts for failed syncs (future enhancement)
3. **Manual Sync**: Run manual sync after major QB changes (e.g., correcting invoices)
4. **Historical Syncs**: Sync previous months when needed for reports

## Future Enhancements
- [ ] Webhook-based sync (trigger on QB changes instead of polling)
- [ ] Failed sync alerts (email/Telegram notification)
- [ ] Sync frequency configuration (hourly vs 15-min)
- [ ] Selective sync (choose specific domains)
- [ ] Sync analytics dashboard
