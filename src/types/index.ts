/**
 * Type Definitions - Barrel Export
 * 
 * Central export point for all custom type definitions.
 * Import types from here instead of individual files.
 * 
 * Example:
 * ```ts
 * import { TimeEntry, TimeEntryWithRelations, DashboardSummaryMetrics } from '@/types'
 * ```
 */

// Time Entry types
export type {
  TimeEntry,
  TimeEntryInsert,
  TimeEntryUpdate,
  TimeEntryWithProject,
  TimeEntryWithRate,
  TimeEntryWithRelations,
  TimeEntryBillRate,
  TimeEntryByEmployee,
  TimeEntryByProject,
  TimeEntryByPhase,
  TimeEntrySummary,
  TimeEntryFilters,
  TimeEntrySortField,
  TimeEntrySortDirection,
  TimeEntrySortOptions,
} from './time-entries'

// Dashboard types
export type {
  UtilizationData,
  UtilizationApiResponse,
  PTOUsageData,
  PTOUsageApiResponse,
  MonthlyMultiplierData,
  MonthlyMultipliersApiResponse,
  DashboardSummaryMetrics,
  MonthlyBreakdownData,
  MonthlyProjectBreakdown,
  MonthBreakdownDetails,
  GrossProfitVsExpensesData,
  FreshnessState,
  OpsFreshnessData,
  DashboardFilters,
} from './dashboard'

// Project types
export type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectStatus,
  ProjectWithClient,
  ProjectWithRelations,
  ProjectPhase,
  ProposalPhase,
  ProjectInvoice,
  ProjectInvoiceInsert,
  ProjectInvoiceUpdate,
  ProjectInvoiceWithLineItems,
  InvoiceLineItem,
  ProjectFinancialSummary,
  ProjectPerformanceData,
  ProjectListItem,
  ProjectFilters,
  ProjectSortField,
  ProjectSortDirection,
  ProjectSortOptions,
  ProjectExpense,
  ProjectPermit,
  ProjectSubmittal,
  ProjectTeamAssignment,
  ProjectActivity,
} from './project'
