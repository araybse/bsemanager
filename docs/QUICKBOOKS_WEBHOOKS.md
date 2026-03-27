# QuickBooks Real-Time Webhook Sync

## Overview

IRIS now supports **real-time synchronization** with QuickBooks Online via webhooks. When data changes in QuickBooks (invoices created, time entries updated, etc.), QuickBooks automatically notifies IRIS, which immediately syncs just that specific record.

### Benefits
- ✅ **Instant updates** - Changes appear in IRIS within seconds
- ✅ **No manual syncing** - Data stays fresh automatically
- ✅ **Reduced load** - Only sync what changed, not everything
- ✅ **Better UX** - Users always see current data

---

## How It Works

```
QuickBooks Online
      ↓
  (User creates invoice)
      ↓
QB sends webhook → https://yourdomain.com/api/qb-webhook
      ↓
IRIS verifies signature
      ↓
IRIS syncs just that invoice
      ↓
Data appears in IRIS immediately
```

---

## Setup Instructions

### 1. Get Webhook Token from QuickBooks

1. Go to https://developer.intuit.com/
2. Sign in and go to **My Apps** → Your IRIS app
3. Go to **Webhooks** section
4. Copy the **Webhook Verifier Token**

### 2. Add Environment Variables

Add to `.env.local`:

```bash
# QuickBooks Webhook Configuration
QB_WEBHOOK_TOKEN=your_webhook_verifier_token_here
INTERNAL_SYNC_TOKEN=generate_a_random_secure_token_here

# Your public URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=https://iris.yourdomain.com
```

**Generate INTERNAL_SYNC_TOKEN:**
```bash
openssl rand -base64 32
```

### 3. Deploy to Production

Webhooks only work on publicly accessible URLs (not localhost).

Make sure:
- ✅ IRIS is deployed to Vercel/production
- ✅ `NEXT_PUBLIC_APP_URL` points to your live domain
- ✅ Environment variables are set in Vercel dashboard

### 4. Register Webhook with QuickBooks

In QuickBooks Developer Dashboard:

1. Go to **Webhooks** → **Add Subscription**
2. Set **Webhook Endpoint URL**: `https://iris.yourdomain.com/api/qb-webhook`
3. Select entities to monitor:
   - ✅ Invoice
   - ✅ TimeActivity
   - ✅ Bill
   - ✅ Payment
   - ✅ Customer
   - ✅ Project

4. Click **Save**
5. QB will send a test request - if it returns HTTP 200, you're good!

---

## Supported Entities

| QuickBooks Entity | IRIS Domain | Operations |
|-------------------|-------------|------------|
| Invoice | invoices | Create, Update, Delete |
| TimeActivity | time_entries | Create, Update, Delete |
| Bill | expenses | Create, Update |
| Payment | payments | Create, Update |
| Customer | customers | Create, Update |
| Project | projects | Create, Update |

---

## Testing Webhooks

### Test Webhook Endpoint

```bash
# Test that endpoint is accessible
curl https://iris.yourdomain.com/api/qb-webhook

# Should return:
# {"status":"webhook_ready","message":"QuickBooks webhook endpoint is active"}
```

### Test with Real Data

1. Create an invoice in QuickBooks Online
2. Watch IRIS - invoice should appear within 5-10 seconds
3. Check sync_runs table to see webhook trigger:

```sql
SELECT * FROM sync_runs 
WHERE trigger_mode = 'webhook' 
ORDER BY started_at DESC 
LIMIT 10;
```

### Troubleshooting

**Webhook not receiving events:**
- Check `QB_WEBHOOK_TOKEN` is set correctly
- Verify `NEXT_PUBLIC_APP_URL` matches your deployed URL
- Check Vercel logs for webhook requests
- Ensure QB developer dashboard shows webhook as "Active"

**Sync failing:**
- Check `sync_runs` table for error messages
- Verify QB OAuth tokens are still valid (refresh if needed)
- Check entity IDs are correct

---

## Security

### Signature Verification

Every webhook request includes an `intuit-signature` header. IRIS verifies this using HMAC-SHA256 with your webhook token. This ensures:

1. ✅ Request came from QuickBooks (not spoofed)
2. ✅ Payload wasn't tampered with
3. ✅ Only your QB company can trigger syncs

### Internal Sync Token

The `INTERNAL_SYNC_TOKEN` allows webhook-triggered syncs to bypass normal auth checks. Keep this secret! It's like a service account password.

---

## Manual Sync Still Available

Webhooks are automatic, but you can still manually sync:

- **All domains**: POST `/api/qb-time/sync` (existing endpoint)
- **Single invoice**: POST `/api/qb-time/sync/invoices/[id]`
- **Single time entry**: POST `/api/qb-time/sync/time-entries/[id]`

Manual sync is useful for:
- Backfilling historical data
- Recovering from errors
- Debugging sync issues

---

## Monitoring

### Webhook Activity Dashboard

Check `/api/qb-webhook` GET endpoint for status.

### Database Monitoring

```sql
-- Webhook activity in last 24 hours
SELECT 
  domain,
  COUNT(*) as events,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM sync_runs
WHERE trigger_mode = 'webhook'
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY domain;
```

---

## Rate Limits

QuickBooks webhooks are subject to their rate limits:
- Max 100 notifications per entity per minute
- Max 10,000 notifications per day

IRIS handles this gracefully by:
- Queueing multiple changes to same entity
- Batching updates when possible
- Logging rate limit errors

---

## What's Next?

Once webhooks are set up, IRIS will:
1. ✅ Auto-sync all invoice changes
2. ✅ Auto-sync all time entry changes
3. ✅ Auto-sync all payment changes
4. ✅ Keep expense data fresh
5. ✅ Update customer/project info automatically

**Result:** You never have to click "Sync" again! 🎉

---

## Troubleshooting Guide

### Webhook Not Registered

**Problem:** QB says "Webhook endpoint unreachable"

**Fix:**
1. Verify URL is publicly accessible (not localhost)
2. Check HTTPS certificate is valid
3. Ensure `/api/qb-webhook` returns 200 on GET

### Signature Verification Failing

**Problem:** Logs show "Invalid webhook signature"

**Fix:**
1. Double-check `QB_WEBHOOK_TOKEN` matches QB developer dashboard
2. Ensure no extra spaces/newlines in token
3. Verify you copied the **Webhook Verifier Token**, not OAuth keys

### Syncs Not Triggering

**Problem:** Webhook received, but sync doesn't run

**Fix:**
1. Check `INTERNAL_SYNC_TOKEN` is set
2. Verify `NEXT_PUBLIC_APP_URL` is correct
3. Check Supabase connection is working
4. Review sync_runs table for error details

---

## Support

Questions? Check:
- QuickBooks Webhook Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
- IRIS sync logs: `sync_runs` table
- Vercel deployment logs

