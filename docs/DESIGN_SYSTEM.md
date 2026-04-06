# IRIS Design System - Chart Colors

## Overview

This document describes the color palette and usage guidelines for all charts and data visualizations in the IRIS application.

## Color Palette

### Primary Palette

Use these colors **in order** for multi-series charts (bar charts with multiple categories, pie charts, etc.):

1. **Blue** `#3b82f6` - Primary brand color
2. **Violet** `#8b5cf6`
3. **Pink** `#ec4899`
4. **Amber** `#f59e0b`
5. **Emerald** `#10b981`
6. **Cyan** `#06b6d4`
7. **Orange** `#f97316`
8. **Lime** `#84cc16`

The palette will wrap automatically if you have more than 8 series.

### Semantic Colors

Use these colors for **meaningful data states**:

- **Positive** `#10b981` (green) - Profit, revenue, under budget, success
- **Negative** `#ef4444` (red) - Cost, loss, over budget, errors
- **Neutral** `#6b7280` (gray) - Neutral state, baseline
- **Warning** `#f59e0b` (amber) - Alerts, approaching threshold
- **Info** `#3b82f6` (blue) - Information, primary data series

### Gradients

Use for heatmaps, single-series intensity variations:

- **Blue Gradient**: `#dbeafe` → `#2563eb`
- **Purple Gradient**: `#ede9fe` → `#7c3aed`
- **Green Gradient**: `#d1fae5` → `#059669`
- **Amber Gradient**: `#fef3c7` → `#d97706`

## Usage Guidelines

### Multi-Series Bar Charts

**Example: Agent breakdown, model breakdown**

```tsx
import { CHART_COLORS, getChartColor } from '@/lib/charts/colors';

agents.map((agent, index) => (
  <Bar 
    key={agent} 
    dataKey={agent} 
    fill={getChartColor(index)} 
  />
))
```

### Pie Charts

**Example: Phase breakdown, agent distribution**

```tsx
import { CHART_COLORS, getChartColor } from '@/lib/charts/colors';

<Pie data={data} dataKey="value">
  {data.map((entry, index) => (
    <Cell 
      key={`cell-${index}`} 
      fill={getChartColor(index)} 
    />
  ))}
</Pie>
```

### Single-Series Line Charts

**Example: Hourly breakdown, daily trends**

```tsx
import { CHART_COLORS } from '@/lib/charts/colors';

<Line 
  type="monotone" 
  dataKey="cost" 
  stroke={CHART_COLORS.semantic.info}  // Use blue for primary info
  strokeWidth={2}
/>
```

### Budget/Progress Bars

**Example: Budget progress indicator**

```tsx
import { getBudgetColor } from '@/lib/charts/colors';

const percentage = (current / budget) * 100;
const color = getBudgetColor(percentage);

<div 
  className="h-3 rounded-full transition-all"
  style={{ 
    width: `${Math.min(percentage, 100)}%`,
    backgroundColor: color 
  }}
/>
```

### Grid Lines

**Always use neutral gray for grid lines:**

```tsx
<CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
```

## Consistency Rules

1. **Never hardcode chart colors** - Always import from `@/lib/charts/colors.ts`
2. **Use the same color for the same data** - If "Max" is blue in one chart, keep it blue everywhere
3. **Maintain semantic meaning** - Green = positive, Red = negative, Amber = warning
4. **Use primary palette in order** - Don't skip colors or randomize order
5. **Match Project Detail Dashboard** - All charts should feel visually cohesive

## Where This Applies

- ✅ Project Detail Dashboard (`/projects/[id]`)
- ✅ API Costs Dashboard (`/admin/costs`)
- ✅ Cash Flow Charts
- ✅ Time Tracking Charts
- ✅ Any future data visualization

## Testing Consistency

Compare dashboards side-by-side:

1. Open Project Detail Dashboard
2. Open API Costs Dashboard in another tab
3. Verify same colors for similar chart types
4. Check budget bars use semantic colors correctly

---

**Last Updated:** April 6, 2026  
**Maintained By:** Development Team
