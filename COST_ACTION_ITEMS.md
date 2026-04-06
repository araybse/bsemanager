# 🎯 API Cost Action Items - For Austin

**Generated:** April 6, 2026  
**Priority:** High — April costs are 10x February levels  

---

## 🚨 Critical (This Week)

### 1. Investigate April 2-3 Cost Spike ($285/day)

**Why:** Costs spiked to ~$285/day (vs typical $50-90)

**What to check:**
- [ ] What tasks/processes were running April 2-3?
- [ ] Was it expected production load or runaway automation?
- [ ] What triggered heavy Opus 4 usage (~$168 on April 2)?
- [ ] Can these tasks be optimized or batched?

**Where to look:**
- Application logs for April 2-3
- Task queue/scheduler history
- User activity logs
- Any large batch processing jobs

**Expected outcome:** Understand if spike was:
- ✅ Expected (production launch, large project)
- ⚠️ Optimization opportunity (can use cheaper model)
- 🚨 Runaway process (needs circuit breaker)

---

### 2. Set Up Cost Monitoring Alerts

**Why:** Daily costs increased 919% March → April

**Action:**
- [ ] Set alert threshold: >$150/day
- [ ] Configure notification channel (email/Slack/SMS)
- [ ] Daily cost summary report
- [ ] Weekly budget review

**Implementation options:**

**Option A: Simple cron job**
```bash
# Add to crontab: daily check at 9am
0 9 * * * cd ~/.openclaw/workspace/bsemanager && node scripts/check_daily_costs.mjs
```

**Option B: Supabase webhook**
- Trigger on new `api_costs` rows
- Aggregate daily totals
- Alert if >$150

**Option C: Dashboard widget**
- Real-time cost display
- Red/yellow/green status
- Budget burn rate

---

### 3. Enable Caching for Opus 4 Calls

**Why:** Current Opus 4 usage has ZERO cache utilization

**Problem:**
- All Opus 4 tokens are `input_no_cache`
- Missing potential 90% savings on repeated contexts

**Action:**
- [ ] Review code that calls Opus 4
- [ ] Add prompt caching headers/parameters
- [ ] Test cache effectiveness

**Example fix:**
```javascript
// Before (no cache)
const response = await anthropic.messages.create({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: prompt }]
});

// After (with cache)
const response = await anthropic.messages.create({
  model: 'claude-opus-4',
  messages: [{ 
    role: 'user', 
    content: prompt,
    cache_control: { type: 'ephemeral' } // Enable caching
  }]
});
```

**Potential savings:** If 50% of Opus 4 calls benefit from cache, could save ~$50-100/month

---

## 🎯 Important (Next 2 Weeks)

### 4. Document Caching Best Practices

**Why:** Current cache strategy is effective (34% hit rate) — share the knowledge

**Action:**
- [ ] Document when to use cache vs no-cache
- [ ] How to structure prompts for cache efficiency
- [ ] Examples of good/bad caching patterns
- [ ] Share with development team

**Outline:**
```markdown
# API Caching Best Practices

## When to Cache
- ✅ System prompts (same across requests)
- ✅ Large context that doesn't change often
- ✅ Reference documentation
- ❌ User-specific dynamic content
- ❌ One-time queries

## Cache ROI
- Cache write costs: 25% more than regular input
- Cache read costs: 90% less than regular input
- Break-even: 2 reads per write
- Current hit rate: 34% (excellent!)

## Code Examples
...
```

---

### 5. Implement Estimate Tracking

**Why:** Enable budget planning and variance analysis

**Current state:** No estimates tracked, only actuals

**Action:**
- [ ] Add cost estimation when planning tasks
- [ ] Store estimates in `api_costs` table (`source='estimate'`)
- [ ] Monthly comparison report: estimate vs actual
- [ ] Refine estimation model based on variance

**Example workflow:**
1. Planning: "This feature will need ~1000 Sonnet calls = $45 estimated"
2. Track: Insert estimate into database
3. Execute: Actual costs tracked automatically
4. Review: Compare estimate vs actual, adjust future estimates

---

### 6. Add Rate Limiting / Circuit Breakers

**Why:** Prevent runaway costs from automation

**Risk scenarios:**
- Infinite loop in API calls
- Batch job with no error handling
- Retry logic without exponential backoff
- Test code accidentally hitting production

**Protection strategies:**

**Option A: API key budget limits**
```javascript
// Daily budget per API key
const DAILY_LIMITS = {
  'bsemaxbot': 200, // $200/day max
  'austin-onboarding-api-key': 10
};

async function checkDailyBudget(apiKey) {
  const today = await getDailyCost(apiKey);
  if (today >= DAILY_LIMITS[apiKey]) {
    throw new Error(`Daily budget exceeded: $${today}`);
  }
}
```

**Option B: Call rate limiting**
```javascript
// Max 100 API calls per minute
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100
});
```

**Option C: Cost anomaly detection**
```javascript
// Alert if hourly cost > 3x daily average
async function checkAnomalies() {
  const hourly = await getHourlyCost();
  const dailyAvg = await getDailyAverage();
  
  if (hourly > dailyAvg * 3) {
    alert('Cost anomaly detected!');
  }
}
```

---

## 📊 Strategic (Next Month)

### 7. Build Cost Dashboard

**Features:**
- [ ] Real-time cost display
- [ ] Today/week/month totals
- [ ] Model usage breakdown
- [ ] Budget burn rate
- [ ] Cost per project/feature
- [ ] Trend charts

**Tech stack:**
- Frontend: React + Recharts
- Backend: Supabase real-time subscriptions
- Refresh: Every 5 minutes
- Alerts: Push notifications

---

### 8. Optimize Model Usage

**Audit questions:**
- Are we using the right model for each task?
- Can simple tasks use Haiku instead of Sonnet?
- Can complex tasks use Sonnet instead of Opus?
- Are we benefiting from extended thinking when we pay for it?

**Model pricing reminder:**
```
Haiku 4.5:   $1/MTok input, $5/MTok output   (cheapest)
Sonnet 4.5:  $3/MTok input, $15/MTok output  (balanced)
Opus 4:      $15/MTok input, $75/MTok output (premium)
```

**Action:**
- [ ] List all API call sites
- [ ] Categorize by task complexity
- [ ] Identify optimization opportunities
- [ ] A/B test Sonnet vs Opus for borderline cases

---

### 9. Project-Level Cost Attribution

**Why:** Understand which projects/features cost the most

**Implementation:**
- [ ] Add `project_id` or `feature_tag` to API calls
- [ ] Track in database or metadata
- [ ] Monthly cost breakdown by project
- [ ] ROI analysis: cost vs value delivered

**Example:**
```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5',
  messages: [...],
  metadata: {
    project_id: 'iris-launch',
    feature: 'timesheet-automation'
  }
});

// Later: analyze costs by project
SELECT 
  metadata->>'project_id' as project,
  SUM(cost_usd) as total_cost
FROM api_costs
GROUP BY project;
```

---

## 📋 Checklist Summary

### Week 1 (Critical)
- [ ] Investigate April 2-3 spike
- [ ] Set up cost alerts (>$150/day)
- [ ] Enable Opus 4 caching

### Week 2-3 (Important)
- [ ] Document caching best practices
- [ ] Implement estimate tracking
- [ ] Add rate limiting/circuit breakers

### Month 1-2 (Strategic)
- [ ] Build cost dashboard
- [ ] Audit & optimize model usage
- [ ] Project-level cost attribution

---

## 📊 Expected Impact

**If all actions implemented:**

| Action | Expected Savings | Effort |
|--------|------------------|--------|
| Opus 4 caching | $50-100/month | 4 hours |
| Model optimization | $200-400/month | 1 week |
| Rate limiting | Prevent runaway costs | 8 hours |
| Better estimates | Improve planning | 4 hours |
| **Total** | **$250-500/month** | **2-3 weeks** |

---

## 🚀 Quick Start

**Right now (30 minutes):**

1. **Review the spike**
```bash
cd ~/.openclaw/workspace/bsemanager
cat API_COST_ANALYSIS_REPORT.md | grep -A 10 "April 2-3"
```

2. **Check what happened April 2-3**
```bash
# Check application logs
grep "2026-04-02\|2026-04-03" /path/to/app.log

# Check task queue
# Check user activity
```

3. **Set up simple alert**
```bash
# Add to crontab (crontab -e)
0 9 * * * node ~/.openclaw/workspace/bsemanager/scripts/check_daily_costs.mjs
```

---

## 📞 Questions?

Review full documentation:
- `API_COST_ANALYSIS_REPORT.md` — Detailed analysis
- `COST_BACKFILL_COMPLETE.md` — Executive summary  
- `COST_SNAPSHOT.md` — Quick reference
- `docs/api-cost-tracking.md` — Technical guide

---

**Prepared by:** Sebastian (Max's subagent)  
**Date:** April 6, 2026  
**Status:** Ready for your review
