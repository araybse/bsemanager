/**
 * Dashboard Types
 * 
 * Type definitions for dashboard data structures and API responses.
 * These types replace 'any' types in dashboard components and API routes.
 */

/**
 * Utilization data for a single period
 */
export interface UtilizationData {
  /**
   * Period key (e.g., "2024-03", "2024-Q1", "2024")
   */
  period: string
  
  /**
   * Human-readable period label (e.g., "Mar 2024", "Q1 2024")
   */
  periodLabel: string
  
  /**
   * Total hours worked in this period
   */
  totalHours: number
  
  /**
   * Hours on billable projects (excludes Admin, PTO, etc.)
   */
  projectHours: number
  
  /**
   * Utilization rate as percentage (0-100)
   */
  utilizationRate: number
}

/**
 * Response from utilization API endpoint
 */
export interface UtilizationApiResponse {
  /**
   * Period type used for grouping
   */
  period: 'month' | 'quarter' | 'year'
  
  /**
   * Employee ID if filtered, or null for all employees
   */
  employeeId: string | null
  
  /**
   * Array of utilization data points
   */
  utilization: UtilizationData[]
}

/**
 * PTO usage data for a single period
 */
export interface PTOUsageData {
  /**
   * Period key (e.g., "2024-03", "2024-Q1", "2024")
   */
  period: string
  
  /**
   * Human-readable period label (e.g., "Mar 2024", "Q1 2024")
   */
  periodLabel: string
  
  /**
   * Total PTO hours in this period
   */
  totalHours: number
  
  /**
   * Breakdown by PTO type
   */
  byType: {
    PTO: number
    Vacation: number
    Sick: number
  }
}

/**
 * Response from PTO usage API endpoint
 */
export interface PTOUsageApiResponse {
  /**
   * Period type used for grouping
   */
  period: 'month' | 'quarter' | 'year'
  
  /**
   * Employee ID if filtered, or null for all employees
   */
  employeeId: string | null
  
  /**
   * Array of PTO usage data points
   */
  ptoUsage: PTOUsageData[]
}

/**
 * Monthly multiplier data (revenue / cost) for C* phases
 */
export interface MonthlyMultiplierData {
  /**
   * Month key in YYYY-MM format
   */
  month: string
  
  /**
   * Human-readable month label (e.g., "Mar '24")
   */
  monthLabel: string
  
  /**
   * Total revenue for C* phases in this month
   */
  revenue: number
  
  /**
   * Total labor cost for C* phases in this month
   */
  cost: number
  
  /**
   * Multiplier (revenue / cost), or null if no cost
   */
  multiplier: number | null
}

/**
 * Response from monthly multipliers API endpoint
 */
export interface MonthlyMultipliersApiResponse {
  /**
   * Array of monthly multiplier data points
   */
  monthlyMultipliers: MonthlyMultiplierData[]
}

/**
 * Summary metrics for dashboard 4-card view
 */
export interface DashboardSummaryMetrics {
  /**
   * Total contract value across all projects
   */
  totalContract: number
  
  /**
   * Total revenue invoiced
   */
  totalRevenue: number
  
  /**
   * Total cost (labor + expenses)
   */
  totalCost: number
  
  /**
   * Overall performance multiplier (revenue / cost)
   */
  performanceMultiplier: number | null
}

/**
 * Monthly breakdown data for revenue vs billable work
 */
export interface MonthlyBreakdownData {
  /**
   * Month key in YYYY-MM format
   */
  month: string
  
  /**
   * Human-readable month label
   */
  monthLabel: string
  
  /**
   * Total invoiced amount for this month
   */
  invoiceAmount: number
  
  /**
   * Total billable amount for this month (hours × rates)
   */
  billableAmount: number
}

/**
 * Project breakdown within a monthly period
 */
export interface MonthlyProjectBreakdown {
  /**
   * Project number
   */
  projectNumber: string
  
  /**
   * Project name
   */
  projectName: string
  
  /**
   * Amount invoiced for this project in the period
   */
  invoiced: number
  
  /**
   * Billable amount for this project in the period
   */
  billable: number
}

/**
 * Detailed breakdown for a selected month
 */
export interface MonthBreakdownDetails {
  /**
   * Month being analyzed
   */
  month: string
  
  /**
   * Month label
   */
  monthLabel: string
  
  /**
   * Total invoiced amount
   */
  totalInvoiced: number
  
  /**
   * Total billable amount
   */
  totalBillable: number
  
  /**
   * Breakdown by project
   */
  projects: MonthlyProjectBreakdown[]
}

/**
 * Gross profit vs expenses data point
 */
export interface GrossProfitVsExpensesData {
  /**
   * Month key in YYYY-MM format
   */
  month: string
  
  /**
   * Human-readable month label
   */
  monthLabel: string
  
  /**
   * Gross profit from P&L
   */
  grossProfit: number
  
  /**
   * Total expenses from P&L
   */
  totalExpenses: number
}

/**
 * Freshness state for data quality indicators
 */
export type FreshnessState = 'fresh' | 'stale' | 'critical' | 'unknown'

/**
 * Operations freshness data
 */
export interface OpsFreshnessData {
  /**
   * Overall freshness state
   */
  state: FreshnessState
  
  /**
   * Last successful sync timestamp
   */
  syncAt: string | null
  
  /**
   * Last data quality run timestamp
   */
  qualityAt: string | null
}

/**
 * Dashboard filter state
 */
export interface DashboardFilters {
  /**
   * Selected project manager ID, or 'all'
   */
  selectedPM?: string
  
  /**
   * Selected employee ID, or 'all'
   */
  selectedEmployee?: string
  
  /**
   * Period type for time-based charts
   */
  selectedPeriod?: 'month' | 'quarter' | 'year'
  
  /**
   * Date range start
   */
  startDate?: string | null
  
  /**
   * Date range end
   */
  endDate?: string | null
}
