/**
 * Format number as currency (USD)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format number as percentage
 */
export function formatPercent(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return '0%'
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format hours (2 decimal places)
 */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0.00'
  return value.toFixed(2)
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[$,]/g, '')) || 0
}
