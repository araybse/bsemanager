/**
 * Financial Module - Canonical Entry Point
 * 
 * Import financial functions from here for consistency.
 */

// Core financial computation (queries database)
export { computeProjectFinancials } from './computeProjectFinancials'
export type { ProjectFinancials } from './computeProjectFinancials'

// Financial metrics and formulas (pure calculation functions)
export {
  calculateRevenue,
  calculateCost,
  calculateProfit,
  calculateMultiplier,
  calculateMargin,
  calculateProjectFinancials,
  calculatePhaseFinancials,
  formatCurrency,
  formatMultiplier,
  formatMargin,
  getMultiplierColor,
  getMarginColor,
} from './metrics'

export type {
  ProjectFinancials as ProjectFinancialsMetrics,
  PhaseFinancials,
} from './metrics'
