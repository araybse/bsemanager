/**
 * Project Types
 * 
 * Type definitions for projects, phases, and invoices.
 * These types replace 'any' types throughout the application.
 */

import type { Database, ProjectStatus as DbProjectStatus, BillingType } from '@/lib/types/database'

/**
 * Base project from database (Row type)
 */
export type Project = Database['public']['Tables']['projects']['Row']

/**
 * Project for inserts (optional fields)
 */
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']

/**
 * Project for updates (all fields optional)
 */
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

/**
 * Project status type
 */
export type ProjectStatus = DbProjectStatus

/**
 * Project with client relationship
 */
export interface ProjectWithClient extends Project {
  clients: {
    id: number
    name: string
    address_line_1: string | null
    address_line_2: string | null
    email: string | null
  } | null
}

/**
 * Project with all major relationships
 */
export interface ProjectWithRelations extends Project {
  /**
   * Client information
   */
  clients: {
    id: number
    name: string
    address_line_1: string | null
    address_line_2: string | null
    email: string | null
  } | null
  
  /**
   * Project manager profile
   */
  profiles: {
    id: string
    full_name: string
    email: string
    title: string | null
  } | null
  
  /**
   * Related proposal
   */
  proposals: {
    id: number
    proposal_number: string
    name: string
    total_amount: number | null
    bse_amount: number | null
    date_submitted: string | null
    date_executed: string | null
    status: string | null
  } | null
  
  /**
   * Contract phases for this project
   */
  contract_phases: ProjectPhase[]
  
  /**
   * Project team assignments
   */
  project_team_assignments: Array<{
    user_id: string
    role: string
    profiles: {
      full_name: string
      email: string
    }
  }>
}

/**
 * Contract phase (from contract_phases table)
 */
export interface ProjectPhase {
  id: number
  project_id: number
  phase_code: string
  phase_name: string
  billing_type: BillingType
  total_fee: number
  billed_to_date: number
  bill_this_month: number
  unbilled_amount: number
  created_at: string
  updated_at: string
}

/**
 * Proposal phase (from proposal_phases table)
 */
export interface ProposalPhase {
  id: number
  proposal_id: number
  phase_code: string
  phase_name: string
  amount: number
  billing_type: BillingType
  created_at: string
  updated_at: string
}

/**
 * Invoice from database
 */
export type ProjectInvoice = Database['public']['Tables']['invoices']['Row']

/**
 * Invoice for inserts
 */
export type ProjectInvoiceInsert = Database['public']['Tables']['invoices']['Insert']

/**
 * Invoice for updates
 */
export type ProjectInvoiceUpdate = Database['public']['Tables']['invoices']['Update']

/**
 * Invoice with line items
 */
export interface ProjectInvoiceWithLineItems extends ProjectInvoice {
  invoice_line_items: InvoiceLineItem[]
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  id: number
  invoice_id: number
  project_number: string
  phase_name: string
  line_type: string | null
  amount: number
  invoice_date: string
  description: string | null
  created_at: string
  updated_at: string
}

/**
 * Project financial summary
 */
export interface ProjectFinancialSummary {
  project_id: number
  project_number: string
  
  /**
   * Contract value
   */
  total_contract: number
  
  /**
   * Total invoiced to date
   */
  total_invoiced: number
  
  /**
   * Total labor cost
   */
  total_labor_cost: number
  
  /**
   * Total expenses
   */
  total_expenses: number
  
  /**
   * Total cost (labor + expenses)
   */
  total_cost: number
  
  /**
   * Remaining contract value
   */
  remaining_contract: number
  
  /**
   * Project multiplier (revenue / cost)
   */
  multiplier: number | null
  
  /**
   * Profit margin percentage
   */
  profit_margin: number | null
}

/**
 * Project performance data
 */
export interface ProjectPerformanceData {
  project_id: number
  project_number: string
  project_name: string
  
  /**
   * Hours breakdown by type
   */
  hours: {
    billable: number
    non_billable: number
    total: number
  }
  
  /**
   * Revenue breakdown
   */
  revenue: {
    invoiced: number
    billable_value: number
    variance: number
  }
  
  /**
   * Cost breakdown
   */
  cost: {
    labor: number
    expenses: number
    total: number
  }
  
  /**
   * Performance metrics
   */
  metrics: {
    multiplier: number | null
    utilization: number | null
    profit_margin: number | null
  }
}

/**
 * Project list item for tables/lists
 */
export interface ProjectListItem {
  id: number
  project_number: string
  name: string
  client_name: string | null
  pm_name: string | null
  status: ProjectStatus
  total_contract: number | null
  total_invoiced: number | null
  multiplier: number | null
  updated_at: string
}

/**
 * Project filters for queries
 */
export interface ProjectFilters {
  status?: ProjectStatus | ProjectStatus[]
  pm_id?: string | null
  client_id?: number | null
  search?: string | null
  municipality?: string | null
}

/**
 * Project sort options
 */
export type ProjectSortField = 
  | 'project_number'
  | 'name'
  | 'client_name'
  | 'status'
  | 'updated_at'
  | 'created_at'

export type ProjectSortDirection = 'asc' | 'desc'

export interface ProjectSortOptions {
  field: ProjectSortField
  direction: ProjectSortDirection
}

/**
 * Project expense (from project_expenses table)
 */
export interface ProjectExpense {
  id: number
  source_system: string
  source_entity_type: string | null
  source_entity_id: string | null
  source_line_id: string | null
  project_id: number | null
  project_number: string | null
  vendor_name: string | null
  expense_date: string
  description: string | null
  category_name: string | null
  sub_category_name: string | null
  fee_amount: number
  is_reimbursable: boolean
  markup_pct: number
  amount_to_charge: number
  status: string
  billing_status: string | null
  invoice_id: number | null
  invoice_number: string | null
  date_invoiced: string | null
  qbo_last_updated_at: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Project permit information
 */
export interface ProjectPermit {
  id: number
  project_id: number
  agency: string
  permit_type: string
  permit_identifier: string
  created_at: string
  updated_at: string
}

/**
 * Project submittal information
 */
export interface ProjectSubmittal {
  id: number
  project_id: number
  agency: string
  department: string | null
  status: string | null
  comment: string | null
  commented_at: string | null
  source_url: string | null
  pdf_url: string | null
  external_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Project team member assignment
 */
export interface ProjectTeamAssignment {
  id: number
  project_id: number
  user_id: string
  role: string
  created_at: string
  profiles?: {
    full_name: string
    email: string
    title: string | null
  }
}

/**
 * Project activity log entry
 */
export interface ProjectActivity {
  id: number
  project_id: number
  user_id: string | null
  action_type: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  profiles?: {
    full_name: string
    email: string
  } | null
}
