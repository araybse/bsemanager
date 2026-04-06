# API Cost Tracking - Real-Time Updates

## Overview

The API Cost Tracking page now features **true real-time updates** that refresh automatically every 5 seconds without requiring a page reload.

## Features

### Real-Time Tab

1. **5-Second Auto-Refresh**
   - Today's spending updates automatically
   - Live Activity Feed shows new sessions immediately
   - Charts animate smoothly with new data
   - No page flicker or flash

2. **Visual Indicators**
   - Green pulsing dot indicates live connection
   - "Auto-refreshing every 5s" badge
   - "Updated X:XX AM/PM EST" timestamp
   - Manual refresh button available

3. **EST Timezone Display**
   - All timestamps converted from UTC to EST
   - Hourly breakdown chart in EST hours
   - Activity feed shows EST times

### Historical Tab

1. **Monthly Cost Breakdown**
   - Bar chart showing costs by month
   - Correct totals from CSV import:
     - February 2026: $284.51
     - March 2026: $566.77
     - April 2026: $1,117.74
   - Total all-time: $1,969.02

2. **Model Breakdown**
   - Horizontal bar chart by model
   - Shows cost attribution per AI model

3. **Daily Trend**
   - 90-day trend line chart
   - Dates displayed in EST

## API Endpoints

### Real-Time Data

**GET `/api/admin/api-costs-realtime`**

Query params:
- `action=today` - Today's costs with breakdown
- `action=summary` - Month totals and averages

Response includes:
- `total_cost` - Total cost for the day
- `session_count` - Number of sessions
- `by_agent` - Costs grouped by agent
- `by_model` - Costs grouped by model
- `hourly_breakdown` - Hour-by-hour costs (EST)
- `sessions` - Last 20 session records

### Historical Data

**GET `/api/costs/monthly`**

Returns:
- `monthly` - Array of monthly totals
- `by_model` - Costs by AI model
- `total` - All-time total
- `record_count` - Number of records

**GET `/api/costs/summary?period=week|month|quarter`**

Returns period-based summaries.

**GET `/api/costs/trends?days=90`**

Returns daily cost trend data.

## Technical Implementation

### Polling (React Query)

```typescript
const { data, refetch } = useQuery({
  queryKey: ['costs', 'realtime', 'today'],
  queryFn: () => fetch('/api/admin/api-costs-realtime?action=today').then(r => r.json()),
  refetchInterval: 5000, // 5 seconds
  refetchIntervalInBackground: false // Only when tab active
});
```

### EST Timezone Conversion

Backend converts hours:
```typescript
function getESTHour(utcDateString: string): number {
  const date = new Date(utcDateString);
  return parseInt(date.toLocaleString('en-US', { 
    timeZone: 'America/New_York', 
    hour: 'numeric', 
    hour12: false 
  }));
}
```

Frontend displays:
```typescript
function formatTimeEST(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
```

## Data Sources

1. **`api_costs_realtime` table** - Live session data from OpenClaw
2. **`api_costs` table** - Historical data from CSV import (Claude Console export)

## Animations

- Budget progress bar: `transition-all duration-500`
- Chart updates: `animationDuration={300}`
- New activity highlight: Green background on latest row
- Number transitions: Smooth value changes
