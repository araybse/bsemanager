# 📸 API Cost Snapshot - Quick Reference

**Period:** Feb 1 - Apr 6, 2026  
**Last Updated:** April 6, 2026  

---

## 💰 Bottom Line

```
Total Actual Spend: $1,969.02
```

| Month | Total | Avg/Day | Trend |
|-------|-------|---------|-------|
| Feb 2026 | $284.51 | $10.16 | 🟢 Baseline |
| Mar 2026 | $566.77 | $18.28 | 🟡 +80% |
| Apr 2026 (6 days) | $1,117.74 | $186.29 | 🔴 +919% |

---

## 🎯 At a Glance

### Where the Money Goes

**Models** (by cost):
1. 🥇 Sonnet 4.5: **$1,139** (58%) — workhorse model
2. 🥈 Opus 4: **$261** (13%) — spike driver
3. 🥉 Haiku 4.5: **$234** (12%) — light tasks
4. Sonnet 4: **$206** (10%)
5. Opus 4.5: **$129** (7%)

**Token Types**:
1. 💾 Cache Write: **$831** (42%) — investing in future savings
2. 📖 Cache Read: **$548** (28%) — reaping cache benefits  
3. 📤 Output: **$358** (18%) — generated tokens
4. ❌ No Cache: **$232** (12%) — missed opportunities

---

## 🔥 Hot Spots

### Most Expensive Days

```
#1  Apr 3  $288.59  🔥🔥🔥
#2  Apr 2  $285.21  🔥🔥🔥
#3  Apr 5  $206.57  🔥🔥
#4  Mar 27 $188.46  🔥
#5  Apr 4  $131.16  
```

**April 2-3 spike:** Heavy Opus 4 usage with zero cache utilization

### Most Expensive Single Charges

```
#1  $83.92  Mar 27  Sonnet 4.5 (cache read)  — huge context!
#2  $81.21  Apr 2   Opus 4 (output)         — massive generation
#3  $74.13  Mar 27  Sonnet 4.5 (cache write)
#4  $63.61  Apr 3   Sonnet 4.5 (cache read)
#5  $53.62  Apr 4   Sonnet 4 (no cache)
```

---

## 📊 Cache Performance

**Hit Rate:** 34% (excellent!)

```
Cache Reads:  75 charges → $548 saved ~90% on these tokens
Cache Writes: 78 charges → $831 investment for future reads
No Cache:     87 charges → $232 missed opportunities
```

**ROI:** Every $1 in cache writes → ~$9 in future read savings

---

## 🔑 API Key Split

```
bsemaxbot:                 207 charges  $1,910 (97%)  🐝 Production
austin-onboarding-api-key: 124 charges  $59 (3%)      👨‍💻 Testing
```

---

## ⚠️ Cost Alerts

### Critical Issues

1. **🔴 April 2-3 spike** — $285/day vs typical $50-90
   - Cause: Heavy Opus 4 usage (~$168 on Apr 2)
   - Issue: Zero cache utilization on Opus 4 calls
   - Action: Enable caching, investigate what triggered spike

2. **🔴 Cost growth** — 919% increase March → April avg daily
   - Feb: $10/day → Apr: $186/day
   - Projection: $5,589/month if pace continues
   - Action: Set budget alerts, review usage patterns

3. **🟡 Large context charges** — Some individual charges >$80
   - Mar 27: $83.92 single Sonnet cache read
   - Apr 2: $81.21 single Opus output
   - Action: Review what's generating such large contexts

---

## ✅ What's Working Well

1. **Cache strategy** — 34% hit rate shows smart prompt reuse
2. **Model mix** — 58% Sonnet (cost-effective), Opus reserved for key tasks
3. **Production focus** — 97% of spend is `bsemaxbot` (primary bot), not test keys

---

## 🎯 Immediate Actions

### This Week

- [ ] **Set cost alerts** — >$150/day threshold
- [ ] **Investigate April 2-3** — What triggered Opus 4 spike?
- [ ] **Enable Opus 4 caching** — Current calls don't leverage cache

### Next 2 Weeks

- [ ] **Implement estimate tracking** — Enable variance analysis
- [ ] **Document caching practices** — Share with team
- [ ] **Add rate limiting** — Prevent runaway automation costs

---

## 📁 Full Reports

- **Detailed Analysis:** `API_COST_ANALYSIS_REPORT.md`
- **Executive Summary:** `COST_BACKFILL_COMPLETE.md`
- **JSON Data:** `data/api_cost_summary.json`

---

**Database:** IRIS `api_costs` table (331 records)  
**Source:** Claude Console CSV exports  
**Verified:** ✅ All data matches source CSVs exactly
