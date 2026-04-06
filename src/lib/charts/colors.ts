/**
 * IRIS Brand Color Palette for Charts
 * 
 * Used consistently across all dashboard charts:
 * - Project Detail Dashboard
 * - API Costs Dashboard
 * - Cash Flow Charts
 * - Time Tracking Charts
 * 
 * Last updated: April 6, 2026
 * 
 * Color scheme extracted from Project Detail Dashboard (projects/[id]/page.tsx)
 */

export const CHART_COLORS = {
  // Primary palette (use in order for multiple series)
  // Extracted from recharts Cell fills in Project Detail Dashboard
  primary: [
    '#3b82f6', // blue-500 - Primary brand color
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
  ],
  
  // Single-color gradients (for heatmaps, single-series)
  gradients: {
    blue: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'],
    purple: ['#ede9fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
    green: ['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669'],
    amber: ['#fef3c7', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706'],
  },
  
  // Semantic colors (for meaningful data states)
  semantic: {
    positive: '#10b981',  // green - profit, revenue, under budget
    negative: '#ef4444',  // red - cost, loss, over budget
    neutral: '#6b7280',   // gray - neutral state
    warning: '#f59e0b',   // amber - alerts, approaching threshold
    info: '#3b82f6',      // blue - information, primary data
  },
};

/**
 * Get a color from the primary palette by index (with wrapping)
 * @param index - The index of the color to retrieve
 * @returns A color string from the primary palette
 */
export const getChartColor = (index: number): string => {
  return CHART_COLORS.primary[index % CHART_COLORS.primary.length];
};

/**
 * Get a semantic color by name
 * @param semantic - The semantic name ('positive', 'negative', 'neutral', 'warning', 'info')
 * @returns A color string
 */
export const getSemanticColor = (semantic: keyof typeof CHART_COLORS.semantic): string => {
  return CHART_COLORS.semantic[semantic];
};

/**
 * Get budget status color based on percentage
 * @param percentage - The budget percentage (0-100+)
 * @returns A color string
 */
export const getBudgetColor = (percentage: number): string => {
  if (percentage >= 100) return CHART_COLORS.semantic.negative; // Over budget
  if (percentage >= 80) return CHART_COLORS.semantic.warning;   // Approaching limit
  return CHART_COLORS.semantic.positive;                         // Under budget
};
