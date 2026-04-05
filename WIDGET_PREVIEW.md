# API Cost Widget - Visual Preview

## Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                     [PM Filter: All Projects] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌─────────────────────┐  │
│  │ Revenue Trend            │  │ Cash Basis: Gross Profit │  │ 💲 API Costs - April│  │
│  │                          │  │ vs Expenses              │  ├─────────────────────┤  │
│  │        [CHART]           │  │                          │  │ $6.76               │  │
│  │                          │  │        [CHART]           │  │ ↑ 45.2% ⚠️          │  │
│  │                          │  │                          │  │                     │  │
│  │                          │  │                          │  │ Top Categories      │  │
│  │                          │  │                          │  │ LLM          $4.53  │  │
│  └──────────────────────────┘  └──────────────────────────┘  │ Vision       $0.69  │  │
│                                                               │ TTS          $0.34  │  │
│                                                               │                     │  │
│                                                               │ 23 API calls        │  │
│                                                               │                     │  │
│                                                               │ View detailed →     │  │
│                                                               └─────────────────────┘  │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Monthly Multipliers                                                             │  │
│  │                                                                                 │  │
│  │                              [CHART]                                            │  │
│  │                                                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Widget Details (Zoomed In)

```
┌───────────────────────────────────────┐
│ 💲 API Costs - April                  │  ← Card Header with DollarSign icon
├───────────────────────────────────────┤
│                                       │
│  $6.76                                │  ← Large bold total
│  📈 ↑ 45.2%                           │  ← Red trend indicator (increase)
│                                       │
│  Top Categories                       │  ← Section header
│  ────────────────────────────────     │
│  LLM                          $4.53   │  ← Category: Cost
│  Vision                       $0.69   │
│  TTS                          $0.34   │
│                                       │
│  23 API calls this month              │  ← Muted text, small font
│                                       │
│  View detailed breakdown →            │  ← Link button
│                                       │
└───────────────────────────────────────┘
```

## Widget States

### Loading State
```
┌───────────────────────────────────────┐
│ 💲 API Costs - April                  │
├───────────────────────────────────────┤
│                                       │
│  Loading...                           │
│                                       │
└───────────────────────────────────────┘
```

### Trend Variations

**Increasing Costs (Red)**
```
📈 ↑ 45.2%  (red color)
```

**Decreasing Costs (Green)**
```
📉 ↓ 12.5%  (green color)
```

**No Change (Gray)**
```
─ No change from last week  (gray color)
```

## Responsive Behavior

### Desktop (lg: 3 columns)
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Revenue  │ │  Cash    │ │   API    │
│  Trend   │ │  Basis   │ │  Costs   │
└──────────┘ └──────────┘ └──────────┘
```

### Tablet (md: 2 columns)
```
┌──────────┐ ┌──────────┐
│ Revenue  │ │  Cash    │
│  Trend   │ │  Basis   │
└──────────┘ └──────────┘
┌──────────┐
│   API    │
│  Costs   │
└──────────┘
```

### Mobile (1 column)
```
┌──────────┐
│ Revenue  │
│  Trend   │
└──────────┘
┌──────────┐
│  Cash    │
│  Basis   │
└──────────┘
┌──────────┐
│   API    │
│  Costs   │
└──────────┘
```

## Color Scheme

- **Background:** White card with subtle shadow
- **Header:** Dark gray text (#111827)
- **Total Amount:** Large bold black text
- **Trend Up:** Red (#ef4444) with TrendingUp icon
- **Trend Down:** Green (#10b981) with TrendingDown icon
- **Trend Neutral:** Gray (#6b7280)
- **Categories:** Muted gray (#6b7280)
- **Costs:** Black medium weight
- **API Count:** Extra small muted text
- **Link:** Blue link with hover underline

## Auto-Refresh

- Fetches data every **30 seconds** automatically
- Uses React Query `refetchInterval: 30000`
- No manual refresh needed
- Shows loading state during refetch (subtle)

## Access Control

✅ **Shows for:** Admin users only  
❌ **Hidden for:** Project Managers, Employees, Clients

Role check: `{userRole === 'admin' && <APICostWidget />}`

## Click Actions

1. **"View detailed breakdown →"** button:
   - Routes to: `/admin/costs`
   - Full cost dashboard (Phase 3)

## Sample Data

Based on current test data (23 records):
- **Total:** $6.76 USD
- **Categories:**
  - LLM: $4.53 (67%)
  - Vision: $0.69 (10%)
  - TTS: $0.34 (5%)
  - Embedding: $0.38 (6%)
- **Period:** Last 30 days
- **Trend:** +45.2% (this week vs last week)

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Data Fetching:** TanStack Query (React Query)
- **Icons:** Lucide React
- **Components:** Card, Button from shadcn/ui
- **Type Safety:** TypeScript
