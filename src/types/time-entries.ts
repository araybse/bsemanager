/**
 * Time Entry Types
 * 
 * Type definitions for time_entries table and related data structures.
 * These types replace 'any' types throughout the application.
 */

import type { Database } from '@/lib/types/database'

/**
 * Base time entry from database (Row type)
 */
export type TimeEntry = Database['public']['Tables']['time_entries']['Row']

/**
 * Time entry for inserts (optional fields)
 */
export type TimeEntryInsert = Database['public']['Tables']['time_entries']['Insert']

/**
 * Time entry for updates (all fields optional)
 */
export type TimeEntryUpdate = Database['public']['Tables']['time_entries']['Update']

/**
 * Time entry with related project information
 */
export interface TimeEntryWithProject extends TimeEntry {
  projects: {
    id: number
    name: string
    project_number: string
  } | null
}

/**
 * Time entry with billing rate information
 */
export interface TimeEntryWithRate {
  id: number
  employee_id: string | null
  employee_name: string
  entry_date: string
  project_number: string
  project_id: number | null
  phase_name: string
  hours: number
  notes: string | null
  hourly_rate: number
  amount: number
  project_name: string
  is_rate_unresolved: boolean
  rate_source: string
}

/**
 * Time entry with full relations (project, invoice, rates)
 */
export interface TimeEntryWithRelations extends TimeEntry {
  /**
   * Related project information
   */
  projects: {
    id: number
    name: string
    project_number: string
    client_id: number | null
    pm_id: string | null
    status: string
  } | null
  
  /**
   * Related invoice information (if billed)
   */
  invoices: {
    id: number
    invoice_number: string
    date_issued: string
    amount: number
  } | null
  
  /**
   * Billing rate snapshot for this entry
   */
  time_entry_bill_rates: {
    time_entry_id: number
    employee_id: string | null
    employee_name: string
    resolved_title: string
    resolved_hourly_rate: number
    rate_source: string
    rate_source_id: number | null
    effective_from_used: string | null
    resolved_at: string
  } | null
}

/**
 * Billing rate snapshot for a time entry
 */
export interface TimeEntryBillRate {
  time_entry_id: number
  employee_id: string | null
  employee_name: string
  resolved_title: string
  resolved_hourly_rate: number
  rate_source: string
  rate_source_id: number | null
  effective_from_used: string | null
  resolved_at: string
}

/**
 * Time entry grouped by employee for reports
 */
export interface TimeEntryByEmployee {
  employee_id: string | null
  employee_name: string
  total_hours: number
  billable_hours: number
  total_amount: number
  entry_count: number
}

/**
 * Time entry grouped by project for reports
 */
export interface TimeEntryByProject {
  project_id: number | null
  project_number: string
  project_name: string | null
  total_hours: number
  billable_hours: number
  total_amount: number
  entry_count: number
}

/**
 * Time entry grouped by phase for reports
 */
export interface TimeEntryByPhase {
  phase_name: string
  total_hours: number
  billable_hours: number
  total_amount: number
  entry_count: number
}

/**
 * Time entry summary for a date range
 */
export interface TimeEntrySummary {
  total_entries: number
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  billed_hours: number
  unbilled_hours: number
  total_labor_cost: number
  total_billable_amount: number
  average_hourly_rate: number
}

/**
 * Filters for querying time entries
 */
export interface TimeEntryFilters {
  employee_id?: string | null
  project_id?: number | null
  project_number?: string | null
  phase_name?: string | null
  start_date?: string | null
  end_date?: string | null
  is_billable?: boolean | null
  is_billed?: boolean | null
  invoice_id?: number | null
  billing_period?: string | null
}

/**
 * Sort options for time entries
 */
export type TimeEntrySortField = 
  | 'entry_date'
  | 'employee_name'
  | 'project_number'
  | 'phase_name'
  | 'hours'
  | 'labor_cost'
  | 'created_at'

export type TimeEntrySortDirection = 'asc' | 'desc'

export interface TimeEntrySortOptions {
  field: TimeEntrySortField
  direction: TimeEntrySortDirection
}
