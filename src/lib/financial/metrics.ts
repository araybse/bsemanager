/**
 * Financial Metrics - Canonical Definitions
 * 
 * THE single source of truth for all financial calculations in IRIS.
 * All dashboards, reports, and displays MUST use these functions.
 * 
 * NO MORE:
 * - "Why do different pages show different profit?"
 * - "What's included in cost?"
 * - "How is multiplier calculated?"
 * 
 * ONE DEFINITION. EVERYWHERE.
 */

export interface ProjectFinancials {
  revenue: number
  cost: number
  profit: number
  multiplier: number
  margin: number // Percentage
}

export interface PhaseFinancials {
  phaseName: string
  hours: number
  revenue: number
  cost: number
  profit: number
  multiplier: number
}

/**
 * REVENUE
 * 
 * Total invoiced amount for a project or phase.
 * 
 * Includes:
 * - All invoiced labor (billable hours × rates)
 * - Reimbursable expenses (with markup)
 * - Lump sum payments
 * 
 * Excludes:
 * - Unbilled time (not yet invoiced)
 * - Pending reimbursables (not yet invoiced)
 * - Contract value (that's potential, not actual)
 */
export function calculateRevenue(params: {
  invoicedLabor: number
  invoicedReimbursables: number
  lumpSumPayments: number
}): number {
  const { invoicedLabor, invoicedReimbursables, lumpSumPayments } = params
  return invoicedLabor + invoicedReimbursables + lumpSumPayments
}

/**
 * COST
 * 
 * Total direct costs incurred on a project or phase.
 * 
 * Includes:
 * - All labor (hours × employee hourly cost) - whether billed or not
 * - Reimbursable expenses (actual expense amount, not marked-up)
 * - Contract labor / subcontractors
 * 
 * Excludes:
 * - Overhead (rent, insurance, general admin)
 * - Unbillable time (internal meetings, training)
 * - Owner's salary (unless directly assigned to project)
 */
export function calculateCost(params: {
  laborCost: number // Total hours × cost rate
  expenseCost: number // Actual expense amounts (no markup)
  contractLaborCost: number // Subcontractor fees
}): number {
  const { laborCost, expenseCost, contractLaborCost } = params
  return laborCost + expenseCost + contractLaborCost
}

/**
 * PROFIT
 * 
 * Simple: Revenue - Cost
 * 
 * This is GROSS profit (before overhead allocation).
 * For NET profit, you'd need to subtract allocated overhead.
 */
export function calculateProfit(revenue: number, cost: number): number {
  return revenue - cost
}

/**
 * MULTIPLIER
 * 
 * How many dollars of revenue generated per dollar of cost.
 * 
 * Formula: Revenue ÷ Cost
 * 
 * Examples:
 * - Multiplier of 3.0 = $3 revenue for every $1 cost (good!)
 * - Multiplier of 1.5 = $1.50 revenue for every $1 cost (okay)
 * - Multiplier of 0.8 = $0.80 revenue for every $1 cost (losing money!)
 * 
 * Industry target: 2.5 - 3.5 for engineering
 */
export function calculateMultiplier(revenue: number, cost: number): number {
  if (cost === 0) return 0 // Avoid division by zero
  return revenue / cost
}

/**
 * MARGIN
 * 
 * Profit as a percentage of revenue.
 * 
 * Formula: (Revenue - Cost) / Revenue × 100
 * 
 * Examples:
 * - 60% margin = Keeping 60 cents of every dollar earned
 * - 30% margin = Keeping 30 cents of every dollar earned
 * - -10% margin = Losing 10 cents on every dollar earned
 * 
 * Industry target: 50-65% for engineering consulting
 */
export function calculateMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0 // Avoid division by zero
  return ((revenue - cost) / revenue) * 100
}

/**
 * Calculate all financial metrics for a project
 * 
 * This is the primary function - use this for dashboards and reports.
 */
export function calculateProjectFinancials(params: {
  invoicedLabor: number
  invoicedReimbursables: number
  lumpSumPayments: number
  laborCost: number
  expenseCost: number
  contractLaborCost: number
}): ProjectFinancials {
  const revenue = calculateRevenue({
    invoicedLabor: params.invoicedLabor,
    invoicedReimbursables: params.invoicedReimbursables,
    lumpSumPayments: params.lumpSumPayments
  })

  const cost = calculateCost({
    laborCost: params.laborCost,
    expenseCost: params.expenseCost,
    contractLaborCost: params.contractLaborCost
  })

  const profit = calculateProfit(revenue, cost)
  const multiplier = calculateMultiplier(revenue, cost)
  const margin = calculateMargin(revenue, cost)

  return {
    revenue,
    cost,
    profit,
    multiplier,
    margin
  }
}

/**
 * Calculate financials for a specific phase
 * 
 * Use this for phase-level analysis (e.g., "How profitable was our design phase?")
 */
export function calculatePhaseFinancials(params: {
  phaseName: string
  hours: number
  invoicedAmount: number // Revenue from this phase
  laborCost: number // Cost of hours worked
  expenseCost?: number // Optional: phase-specific expenses
}): PhaseFinancials {
  const { phaseName, hours, invoicedAmount, laborCost, expenseCost = 0 } = params
  
  const revenue = invoicedAmount
  const cost = laborCost + expenseCost
  const profit = calculateProfit(revenue, cost)
  const multiplier = calculateMultiplier(revenue, cost)

  return {
    phaseName,
    hours,
    revenue,
    cost,
    profit,
    multiplier
  }
}

/**
 * Format currency for display
 * Consistent formatting across the entire app
 */
export function formatCurrency(amount: number, options?: { 
  showCents?: boolean
  showSign?: boolean 
}): string {
  const { showCents = true, showSign = false } = options || {}
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  }).format(amount)

  if (showSign && amount > 0) {
    return `+${formatted}`
  }

  return formatted
}

/**
 * Format multiplier for display
 */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`
}

/**
 * Format margin percentage for display
 */
export function formatMargin(margin: number): string {
  return `${margin.toFixed(1)}%`
}

/**
 * Helper: Get color class for multiplier (for UI indicators)
 */
export function getMultiplierColor(multiplier: number): 'success' | 'warning' | 'danger' {
  if (multiplier >= 2.5) return 'success' // Good
  if (multiplier >= 1.5) return 'warning' // Okay
  return 'danger' // Losing money or break-even
}

/**
 * Helper: Get color class for margin (for UI indicators)
 */
export function getMarginColor(margin: number): 'success' | 'warning' | 'danger' {
  if (margin >= 50) return 'success' // Good
  if (margin >= 30) return 'warning' // Okay
  return 'danger' // Poor or negative
}
