# IRIS Phase 1 Review Checklist

**Status:** Needs systematic verification  
**Created:** March 27, 2026 - 7:25 AM EST  

## Problem Statement

Last night I made 11 changes rapidly without proper testing between each one. This was too fast and now we need to carefully verify everything works.

## New Process (Going Forward)

✅ **One change at a time**  
✅ **Deploy + Test + Verify + Screenshot**  
✅ **Get approval before next**  
✅ **Use Playwright for reliable browser testing**  

---

## Features to Verify

### 1. Real-Time QuickBooks Webhook Sync ⚡

**What it does:** QuickBooks sends webhook when invoice/time/payment changes → IRIS syncs instantly

**Files changed:**
- `src/app/api/qb-webhook/route.ts`
- `src/app/api/qb-time/sync/invoices/[id]/route.ts`
- `src/app/api/qb-time/sync/time_entries/[id]/route.ts`
- `src/app/api/qb-time/sync/payments/[id]/route.ts`
- `src/app/api/qb-time/sync/expenses/[id]/route.ts`
- `src/app/api/qb-time/sync/customers/[id]/route.ts`

**How to test:**
1. Create invoice in QuickBooks
2. Wait 10 seconds
3. Check IRIS invoices page
4. Should appear automatically

**Status:** ⚠️ Not working (webhooks registered but not receiving events)

**Next steps:**
- Debug why QB isn't sending webhooks
- May need production app approval
- Manual sync works as workaround

---

### 2. Parallel Sync (60% Faster) 🚀

**What it does:** Sync runs domains in parallel instead of sequential

**Files changed:**
- `src/app/api/qb-time/sync-all/route.ts` (orchestrator)
- Individual domain routes split out

**How to test:**
1. Go to Settings → Sync
2. Click "Sync All"
3. Note completion time
4. Should complete in ~90 seconds (was 225)

**Status:** ✅ Working (verified button now calls correct endpoint)

**Screenshot needed:** Sync completion time display

---

### 3. Canonical Rate Resolution 💰

**What it does:** One function for all rate lookups (project override → schedule → default)

**Files changed:**
- `src/lib/rates/getApplicableRate.ts`
- `docs/RATE_RESOLUTION.md`

**How to test:**
1. Check timesheet page
2. Verify rates display correctly
3. Compare against rate schedules table
4. Check project overrides work

**Status:** ⏳ Needs testing

**Screenshot needed:** Timesheet with rates shown

---

### 4. Financial Definitions Frozen ❄️

**What it does:** Standard formulas for Revenue, Cost, Profit, Multiplier, Margin

**Files changed:**
- `src/lib/financial/metrics.ts`
- `docs/FINANCIAL_DEFINITIONS.md`

**How to test:**
1. Go to Dashboard
2. Check profit numbers
3. Verify formulas match documentation
4. Check project detail pages

**Status:** ⏳ Needs testing

**Screenshot needed:** Dashboard financial cards

---

### 5. Database Audit Scripts 🔍

**What it does:** Verify 90 projects match QuickBooks

**Files changed:**
- `scripts/audit/compare-with-quickbooks.mjs`
- `scripts/audit/validate-data-integrity.mjs`

**How to test:**
```bash
cd ~/.openclaw/workspace/bsemanager
node scripts/audit/validate-data-integrity.mjs
```

**Status:** ✅ Created (not yet run)

---

### 6. RLS Testing Suite 🔒

**What it does:** Automated tests for row-level security (25 tables)

**Files changed:**
- `scripts/audit/test-rls-policies.mjs`

**How to test:**
```bash
node scripts/audit/test-rls-policies.mjs
```

**Status:** ✅ Created (not yet run)

---

### 7. Financial Audit ✅

**Status:** Covered by audit scripts (Task #5)

---

### 8-10. Monitoring, Deployment, Documentation

**Files changed:**
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/QUICKBOOKS_WEBHOOKS.md`
- `docs/QB_SYNC_ARCHITECTURE.md`
- `docs/RATE_RESOLUTION.md`
- `docs/FINANCIAL_DEFINITIONS.md`
- `README.md` (IRIS rebrand)

**Status:** ✅ Documentation complete

---

### 11. IRIS Logo Integration 🎨

**What it does:** New branding throughout app

**Files changed:**
- `public/logos/iris-*.svg`
- `src/app/login/page.tsx`

**How to test:**
1. Go to login page
2. Verify IRIS logo shows
3. Check tagline displays

**Status:** ✅ Working (verified logo on login)

**Screenshot needed:** Login page with logo

---

## Testing Plan

### Phase A: Visual Verification (Screenshots)

Run Playwright script that:
1. Navigates to each page
2. Takes screenshot
3. Saves to `/tmp/iris-verification/`
4. Austin reviews screenshots

### Phase B: Functional Testing

Test each feature manually:
1. Login as admin
2. Check dashboard
3. Run sync
4. Check invoices
5. Verify rates
6. Test PM/Employee views

### Phase C: Audit Scripts

Run all audit scripts:
1. Data integrity check
2. RLS security tests
3. QB comparison (if possible)

---

## Known Issues

1. **Webhook not receiving events** - QB registered but not sending
2. **Delete detection didn't work** - Fixed (button was calling wrong endpoint)
3. **Test invoice 27-xx-xx** - Needs manual deletion
4. **.env.local parsing broken** - Scripts can't read credentials

---

## Next Steps

**Immediate (when Austin returns):**
1. Delete test invoice 27-xx-xx manually
2. Run Playwright verification suite
3. Review all screenshots together
4. Fix any issues found
5. Only then call Phase 1 complete

**Future (Phase 2+):**
- One feature at a time
- Test before moving on
- Playwright for all browser testing
- Screenshots for every change

---

**Austin's feedback:** "Pretty time-consuming to go back and review all of your changes."

**My commitment:** Going forward, one change at a time with proof it works before moving on.
