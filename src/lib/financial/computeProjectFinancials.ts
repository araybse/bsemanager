import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Project Financial Results
 * 
 * THE canonical financial data structure for a project.
 * All financial calculations flow through this interface.
 */
export interface ProjectFinancials {
  /** Total invoiced revenue (sum of invoice line items) */
  revenue: number
  
  /** Total labor cost (sum of time entries × labor rates) */
  laborCost: number
  
  /** Total expense cost (sum of billable + non-billable project expenses) */
  expenseCost: number
  
  /** Total cost (laborCost + expenseCost) */
  totalCost: number
  
  /** Profit (revenue - totalCost) */
  profit: number
  
  /** Multiplier (revenue / totalCost) - target: 2.5-3.5 */
  multiplier: number
  
  /** Profit margin as percentage (profit / revenue × 100) */
  profitMargin: number
}

/**
 * Compute Project Financials
 * 
 * THE single canonical function for all project financial calculations.
 * 
 * **Master Plan §1.2 Requirement:**
 * All dashboards, reports, and API endpoints MUST use this function.
 * NO ad-hoc financial queries anywhere else in the codebase.
 * 
 * **What This Computes:**
 * - Revenue: Sum of ALL invoice line items (no exclusions)
 * - Labor Cost: Sum of ALL time entry labor costs
 * - Expense Cost: Sum of ALL project expenses (fee_amount, excluding inactive sources)
 * - Total Cost: laborCost + expenseCost
 * - Profit: revenue - totalCost
 * - Multiplier: revenue / totalCost (0 if no cost)
 * - Profit Margin: (profit / revenue) × 100 (0 if no revenue)
 * 
 * **Edge Cases Handled:**
 * - No invoices → revenue = 0
 * - No time entries → laborCost = 0
 * - No expenses → expenseCost = 0
 * - Zero cost → multiplier = 0 (avoid division by zero)
 * - Zero revenue → profitMargin = 0 (avoid division by zero)
 * 
 * @param projectId - Database ID of the project (NOT project_number)
 * @param supabase - Supabase client instance (admin or user context)
 * @returns ProjectFinancials with all computed metrics
 * @throws Error if project not found or database query fails
 * 
 * @example
 * ```typescript
 * const supabase = createAdminClient()
 * const financials = await computeProjectFinancials(42, supabase)
 * console.log(`Revenue: $${financials.revenue.toFixed(2)}`)
 * console.log(`Multiplier: ${financials.multiplier.toFixed(2)}x`)
 * ```
 */
export async function computeProjectFinancials(
  projectId: string,
  supabase: SupabaseClient
): Promise<ProjectFinancials> {
  // Convert projectId to number (handle both string and number inputs)
  const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId
  
  if (!Number.isFinite(projectIdNum) || projectIdNum <= 0) {
    throw new Error(`Invalid project ID: ${projectId}`)
  }

  // 1. Get project and validate it exists
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_number')
    .eq('id', projectIdNum)
    .single()

  if (projectError || !project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const projectNumber = project.project_number

  // 2. Query invoice line items for revenue
  // Revenue = Sum of ALL invoice line items (no exclusions per Master Plan)
  const { data: invoiceLines, error: invoiceError } = await supabase
    .from('invoice_line_items')
    .select('amount')
    .eq('project_number', projectNumber)

  if (invoiceError) {
    throw new Error(`Failed to fetch invoice data: ${invoiceError.message}`)
  }

  const revenue = (invoiceLines || []).reduce((sum, line) => {
    return sum + (Number(line.amount) || 0)
  }, 0)

  // 3. Query time entries for labor cost
  // Labor Cost = Sum of ALL time entry labor costs
  const { data: timeEntries, error: timeError } = await supabase
    .from('time_entries')
    .select('labor_cost')
    .eq('project_number', projectNumber)

  if (timeError) {
    throw new Error(`Failed to fetch time entry data: ${timeError.message}`)
  }

  const laborCost = (timeEntries || []).reduce((sum, entry) => {
    return sum + (Number(entry.labor_cost) || 0)
  }, 0)

  // 4. Query project expenses for expense cost
  // Expense Cost = Sum of fee_amount for active expenses (billable + non-billable)
  // Exclude expenses where source_active = false (closed/cancelled contracts)
  const { data: expenses, error: expenseError } = await supabase
    .from('project_expenses')
    .select('fee_amount, source_active')
    .eq('project_number', projectNumber)

  if (expenseError) {
    throw new Error(`Failed to fetch expense data: ${expenseError.message}`)
  }

  const expenseCost = (expenses || []).reduce((sum, expense) => {
    // Exclude expenses from inactive sources (closed contracts)
    if (expense.source_active === false) {
      return sum
    }
    return sum + (Number(expense.fee_amount) || 0)
  }, 0)

  // 5. Calculate derived metrics
  const totalCost = laborCost + expenseCost
  const profit = revenue - totalCost

  // Handle division by zero for multiplier
  const multiplier = totalCost > 0 ? revenue / totalCost : 0

  // Handle division by zero for profit margin (as percentage)
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0

  return {
    revenue,
    laborCost,
    expenseCost,
    totalCost,
    profit,
    multiplier,
    profitMargin,
  }
}
