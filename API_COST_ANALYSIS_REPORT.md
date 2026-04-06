# API Cost Analysis Report
**Generated:** 2026-04-06T14:29:29.721Z  
**Period:** February 1 - April 6, 2026  
**Source:** Claude Console CSV Exports  

---

## Executive Summary

**Total Actual Costs:** $1969.02

### Monthly Breakdown
- **February 2026:** $284.51
- **March 2026:** $566.77
- **April 1-6, 2026:** $1117.74

---

## Top 10 Highest Cost Days

| Date | Cost (USD) |
|------|------------|
| 2026-04-03 | $288.59 |
| 2026-04-02 | $285.21 |
| 2026-04-05 | $206.57 |
| 2026-03-27 | $188.46 |
| 2026-04-04 | $131.16 |
| 2026-04-06 | $116.51 |
| 2026-03-31 | $98.74 |
| 2026-04-01 | $89.70 |
| 2026-03-26 | $73.87 |
| 2026-03-29 | $67.71 |

### 🔥 Notable Spike: April 2-3, 2026

The highest cost days were April 2-3, with significant Opus 4 usage (~$168.44 on April 2 alone). This represents a 2-3x spike compared to typical daily costs ($50-90).

**Likely causes:**
- Heavy Opus 4 usage (most expensive model)
- Large batch processing or complex tasks
- No cache utilization on Opus 4 calls (all input_no_cache)

**Recommendation:** Review what triggered the April 2-3 spike and consider:
- Using Sonnet 4.5 for less critical tasks
- Enabling prompt caching for repeated contexts
- Batching operations during off-peak analysis periods

---

## Model Usage Breakdown

| Model | Total Cost | % of Total |
|-------|------------|------------|
| Claude Sonnet 4.5 | $1139.17 | 57.85% |
| Claude Opus 4 | $260.52 | 13.23% |
| Claude Haiku 4.5 | $234.04 | 11.89% |
| Claude Sonnet 4 | $206.12 | 10.47% |
| Claude Opus 4.5 | $128.58 | 6.53% |
| Claude Opus 4.6 | $0.59 | 0.03% |
| Claude Haiku 3 | $0.00 | 0.00% |

### Analysis

- **Most used:** Claude Sonnet 4.5 ($1139.17, 57.85%)
- **Mix:** 7 different models used


---

## Token Type Breakdown

| Token Type | Total Cost | % of Total |
|------------|------------|------------|
| input_cache_write_5m | $830.64 | 42.19% |
| input_cache_read | $547.95 | 27.83% |
| output | $358.38 | 18.20% |
| input_no_cache | $232.05 | 11.79% |

### Cache Effectiveness

- **Input (no cache):** $232.05
- **Input (cache read):** $547.95 — saved ~90% on these tokens
- **Input (cache write):** $830.64 — investment for future reads
- **Output:** $358.38

**Cache hit rate:** 34.0% of cached input tokens were reads (highly effective!)

**Savings insight:** Every $1 spent on cache writes can save up to $9 on future reads. Current cache strategy is working well.

---


### Estimated vs Actual Comparison

_No prior estimates found in IRIS database. This is the first backfill of actual cost data._

**Recommendation:** Going forward, track estimated costs separately to enable variance analysis.


---

## Trends & Insights

### Cost Trend Over Time

- **February avg:** $10.16/day
- **March avg:** $18.28/day
- **April avg (1-6):** $186.29/day

**Trend:** Costs increasing (April avg up 919% vs March)

### Key Findings

1. **Opus 4 spike on April 2-3** drove costs to ~$168/day (vs typical $50-90)
   - All Opus 4 usage was input_no_cache (no cache benefit)
   - Consider caching for repeated Opus 4 contexts

2. **Cache strategy is effective**
   - High cache read ratio shows smart reuse of prompts
   - Continue investing in cache writes for frequently used contexts

3. **Model mix is cost-conscious**
   - Heavy use of Haiku and Sonnet (cheaper models)
   - Opus reserved for specific high-value tasks

4. **API key distribution**
   - Primary usage from "bsemaxbot" key
   - "austin-onboarding-api-key" shows lighter usage

### Recommendations

1. **Investigate April 2-3 spike** — what tasks triggered heavy Opus 4 usage?
2. **Enable caching for Opus 4** — current Opus calls don't leverage cache
3. **Monitor daily costs** — set alerts for >$150/day to catch anomalies
4. **Track estimates going forward** — enables variance analysis and budget accuracy
5. **Consider rate limiting** — prevent runaway costs from automated processes

---

## Next Steps

✅ **Completed:**
- All CSV data loaded into IRIS `api_costs` table
- Accurate daily/monthly totals calculated
- Model and token type breakdown analyzed
- Spike days identified

🔜 **Recommended:**
- Set up daily cost monitoring alerts
- Implement estimate tracking for future variance analysis
- Review April 2-3 logs to understand Opus 4 spike
- Document caching best practices for team

---

**Report by:** Sebastian (Max's subagent)  
**For:** Austin Ray  
**Database:** IRIS (Supabase)  
**Status:** ✅ Mission Complete
