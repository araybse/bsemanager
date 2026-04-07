export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'project_manager' | 'employee' | 'client'
export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'
export type BillingType = 'H' | 'L'
export type CashFlowSection = 'income' | 'expenses' | 'balance'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          title: string | null
          rate_position_id: number | null
          role: UserRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          title?: string | null
          rate_position_id?: number | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          title?: string | null
          rate_position_id?: number | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pto_budgets: {
        Row: {
          id: string
          user_id: string
          year: number
          month: number
          budgeted_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          year: number
          month: number
          budgeted_hours: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          year?: number
          month?: number
          budgeted_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: number
          name: string
          address_line_1: string | null
          address_line_2: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          address_line_1?: string | null
          address_line_2?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          address_line_1?: string | null
          address_line_2?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      proposals: {
        Row: {
          id: number
          proposal_number: string
          project_number: string | null
          pm_name: string | null
          pm_id: string | null
          name: string
          total_amount: number | null
          sub_consultants: number
          bse_amount: number | null
          date_submitted: string | null
          date_executed: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          proposal_number: string
          project_number?: string | null
          pm_name?: string | null
          pm_id?: string | null
          name: string
          total_amount?: number | null
          sub_consultants?: number
          bse_amount?: number | null
          date_submitted?: string | null
          date_executed?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          proposal_number?: string
          project_number?: string | null
          pm_name?: string | null
          pm_id?: string | null
          name?: string
          total_amount?: number | null
          sub_consultants?: number
          bse_amount?: number | null
          date_submitted?: string | null
          date_executed?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      proposal_phases: {
        Row: {
          id: number
          proposal_id: number
          phase_code: string
          phase_name: string
          amount: number
          billing_type: BillingType
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          proposal_id: number
          phase_code: string
          phase_name: string
          amount?: number
          billing_type?: BillingType
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          proposal_id?: number
          phase_code?: string
          phase_name?: string
          amount?: number
          billing_type?: BillingType
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: number
          project_number: string
          name: string
          client_id: number | null
          pm_id: string | null
          municipality: string | null
          permit_reference: string | null
          proposal_id: number | null
          status: ProjectStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          project_number: string
          name: string
          client_id?: number | null
          pm_id?: string | null
          municipality?: string | null
          permit_reference?: string | null
          proposal_id?: number | null
          status?: ProjectStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_number?: string
          name?: string
          client_id?: number | null
          pm_id?: string | null
          municipality?: string | null
          permit_reference?: string | null
          proposal_id?: number | null
          status?: ProjectStatus
          created_at?: string
          updated_at?: string
        }
      }
      project_submittals: {
        Row: {
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
        Insert: {
          id?: number
          project_id: number
          agency: string
          department?: string | null
          status?: string | null
          comment?: string | null
          commented_at?: string | null
          source_url?: string | null
          pdf_url?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          agency?: string
          department?: string | null
          status?: string | null
          comment?: string | null
          commented_at?: string | null
          source_url?: string | null
          pdf_url?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_permits: {
        Row: {
          id: number
          project_id: number
          agency: string
          permit_type: string
          permit_identifier: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          project_id: number
          agency: string
          permit_type: string
          permit_identifier: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          agency?: string
          permit_type?: string
          permit_identifier?: string
          created_at?: string
          updated_at?: string
        }
      }
      contract_phases: {
        Row: {
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
        Insert: {
          id?: number
          project_id: number
          phase_code: string
          phase_name: string
          billing_type: BillingType
          total_fee?: number
          billed_to_date?: number
          bill_this_month?: number
          unbilled_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          phase_code?: string
          phase_name?: string
          billing_type?: BillingType
          total_fee?: number
          billed_to_date?: number
          bill_this_month?: number
          unbilled_amount?: number
          created_at?: string
          updated_at?: string
        }
      }
      billable_rates: {
        Row: {
          id: number
          project_id: number
          employee_id: string
          employee_name: string
          hourly_rate: number
          effective_from: string
        }
        Insert: {
          id?: number
          project_id: number
          employee_id: string
          employee_name: string
          hourly_rate: number
          effective_from?: string
        }
        Update: {
          id?: number
          project_id?: number
          employee_id?: string
          employee_name?: string
          hourly_rate?: number
          effective_from?: string
        }
      }
      rate_positions: {
        Row: {
          id: number
          code: string
          name: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      rate_schedules: {
        Row: {
          id: number
          year_label: number
          name: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          year_label: number
          name: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          year_label?: number
          name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      rate_schedule_items: {
        Row: {
          id: number
          schedule_id: number
          position_id: number
          hourly_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          schedule_id: number
          position_id: number
          hourly_rate: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          schedule_id?: number
          position_id?: number
          hourly_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      project_rate_schedule_assignments: {
        Row: {
          id: number
          project_id: number
          schedule_id: number
          source: 'proposal_default' | 'manual_override'
          set_by: string | null
          set_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          project_id: number
          schedule_id: number
          source?: 'proposal_default' | 'manual_override'
          set_by?: string | null
          set_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          schedule_id?: number
          source?: 'proposal_default' | 'manual_override'
          set_by?: string | null
          set_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_rate_position_overrides: {
        Row: {
          id: number
          project_id: number
          position_id: number
          hourly_rate: number
          effective_from: string | null
          effective_to: string | null
          reason: string | null
          set_by: string | null
          set_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          project_id: number
          position_id: number
          hourly_rate: number
          effective_from?: string | null
          effective_to?: string | null
          reason?: string | null
          set_by?: string | null
          set_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          position_id?: number
          hourly_rate?: number
          effective_from?: string | null
          effective_to?: string | null
          reason?: string | null
          set_by?: string | null
          set_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      time_entries: {
        Row: {
          id: number
          employee_id: string | null
          employee_name: string
          entry_date: string
          project_id: number | null
          project_number: string
          phase_name: string
          hours: number
          notes: string | null
          qb_time_id: string | null
          is_billable: boolean
          is_billed: boolean
          invoice_id: number | null
          billing_period: string | null
          labor_cost: number
          status: 'draft' | 'submitted' | 'approved'
          week_ending_date: string
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          employee_id?: string | null
          employee_name: string
          entry_date: string
          project_id?: number | null
          project_number: string
          phase_name: string
          hours: number
          notes?: string | null
          qb_time_id?: string | null
          is_billable?: boolean
          is_billed?: boolean
          invoice_id?: number | null
          billing_period?: string | null
          labor_cost?: number
          status?: 'draft' | 'submitted' | 'approved'
          week_ending_date?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          employee_id?: string | null
          employee_name?: string
          entry_date?: string
          project_id?: number | null
          project_number?: string
          phase_name?: string
          hours?: number
          notes?: string | null
          qb_time_id?: string | null
          is_billable?: boolean
          is_billed?: boolean
          invoice_id?: number | null
          billing_period?: string | null
          labor_cost?: number
          status?: 'draft' | 'submitted' | 'approved'
          week_ending_date?: string
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
        }
      }
      reimbursables: {
        Row: {
          id: number
          project_id: number
          project_number: string
          project_name: string | null
          date_charged: string
          fee_description: string
          fee_amount: number
          markup_pct: number
          amount_to_charge: number
          invoice_id: number | null
          invoice_number: string | null
          date_invoiced: string | null
          created_at: string
        }
        Insert: {
          id?: number
          project_id: number
          project_number: string
          project_name?: string | null
          date_charged: string
          fee_description: string
          fee_amount: number
          markup_pct?: number
          invoice_id?: number | null
          invoice_number?: string | null
          date_invoiced?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          project_number?: string
          project_name?: string | null
          date_charged?: string
          fee_description?: string
          fee_amount?: number
          markup_pct?: number
          invoice_id?: number | null
          invoice_number?: string | null
          date_invoiced?: string | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: number
          invoice_number: string
          project_id: number
          project_number: string
          project_name: string
          date_issued: string
          amount: number
          budget_date: string | null
          date_paid: string | null
          description_of_services: string | null
          pdf_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          invoice_number: string
          project_id: number
          project_number: string
          project_name: string
          date_issued: string
          amount: number
          budget_date?: string | null
          date_paid?: string | null
          description_of_services?: string | null
          pdf_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          invoice_number?: string
          project_id?: number
          project_number?: string
          project_name?: string
          date_issued?: string
          amount?: number
          budget_date?: string | null
          date_paid?: string | null
          description_of_services?: string | null
          pdf_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_line_items: {
        Row: {
          id: number
          invoice_id: number
          project_number: string
          invoice_number: string
          invoice_date: string
          phase_name: string
          amount: number
          line_type: string
          created_at: string
        }
        Insert: {
          id?: number
          invoice_id: number
          project_number: string
          invoice_number: string
          invoice_date: string
          phase_name: string
          amount: number
          line_type?: string
          created_at?: string
        }
        Update: {
          id?: number
          invoice_id?: number
          project_number?: string
          invoice_number?: string
          invoice_date?: string
          phase_name?: string
          amount?: number
          line_type?: string
          created_at?: string
        }
      }
      memberships: {
        Row: {
          id: number
          name: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          notes?: string | null
          created_at?: string
        }
      }
      membership_schedule: {
        Row: {
          id: number
          membership_id: number
          month: number
          amount: number
          year: number
        }
        Insert: {
          id?: number
          membership_id: number
          month: number
          amount?: number
          year?: number
        }
        Update: {
          id?: number
          membership_id?: number
          month?: number
          amount?: number
          year?: number
        }
      }
      cash_flow_entries: {
        Row: {
          id: number
          year: number
          month: number
          category: string
          subcategory: string | null
          section: CashFlowSection
          amount: number
          is_actual: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          year: number
          month: number
          category: string
          subcategory?: string | null
          section: CashFlowSection
          amount?: number
          is_actual?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          year?: number
          month?: number
          category?: string
          subcategory?: string | null
          section?: CashFlowSection
          amount?: number
          is_actual?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contract_labor: {
        Row: {
          id: number
          project_id: number | null
          project_number: string | null
          project_name: string | null
          vendor_name: string
          payment_date: string | null
          description: string | null
          year: number
          month: number
          amount: number
          qb_expense_id: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          project_id?: number | null
          project_number?: string | null
          project_name?: string | null
          vendor_name: string
          payment_date?: string | null
          description?: string | null
          year: number
          month: number
          amount: number
          qb_expense_id?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          project_id?: number | null
          project_number?: string | null
          project_name?: string | null
          vendor_name?: string
          payment_date?: string | null
          description?: string | null
          year?: number
          month?: number
          amount?: number
          qb_expense_id?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      qbo_income: {
        Row: {
          id: number
          project_number: string
          project_name: string | null
          invoice_number: string | null
          date_paid: string
          amount: number
          phase_name: string | null
          qbo_transaction_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          project_number: string
          project_name?: string | null
          invoice_number?: string | null
          date_paid: string
          amount: number
          phase_name?: string | null
          qbo_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          project_number?: string
          project_name?: string | null
          invoice_number?: string | null
          date_paid?: string
          amount?: number
          phase_name?: string | null
          qbo_transaction_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      project_financial_totals: {
        Row: {
          project_id: number
          project_number: string
          project_name: string
          revenue: number
          labor_cost: number
        }
      }
      billing_candidates: {
        Row: {
          project_id: number
          project_number: string
          project_name: string
          reasons: string[]
        }
      }
      active_contracts_view: {
        Row: {
          id: number
          project_id: number
          project_number: string
          project_name: string
          phase_code: string
          phase_name: string
          billing_type: BillingType
          total_fee: number
          billed_to_date: number
          bill_this_month: number
          unbilled_amount: number
          remaining: number
          pct_complete: number
        }
      }
      accounts_receivable_view: {
        Row: {
          id: number
          invoice_number: string
          project_id: number
          project_number: string
          project_name: string
          date_issued: string
          amount: number
          budget_date: string | null
          date_paid: string | null
          description_of_services: string | null
          pdf_url: string | null
          created_at: string
          updated_at: string
          days_outstanding: number
        }
      }
      backlog_summary: {
        Row: {
          total_backlog: number
          project_count: number
          total_contracted: number
          total_billed: number
        }
      }
      income_tracker: {
        Row: {
          project_number: string
          project_name: string
          phase_code: string
          phase_name: string
          contract_amount: number
          invoiced: number
          remaining: number
        }
      }
    }
    Functions: {
      get_next_invoice_number: {
        Args: { p_project_number: string }
        Returns: string
      }
      finalize_invoice: {
        Args: { p_invoice_id: number }
        Returns: void
      }
      get_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
    }
    Enums: {
      user_role: UserRole
      project_status: ProjectStatus
      billing_type: BillingType
      cash_flow_section: CashFlowSection
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']

// Knowledge Graph types
export interface CanonicalEntity {
  id: string
  canonical_name: string
  entity_type: string
  confidence: number
  attributes: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CanonicalRelationship {
  id: string
  from_entity_id: string
  to_entity_id: string
  relationship_type: string
  current_strength: number
  interaction_count: number
  created_at: string
  updated_at: string
}
