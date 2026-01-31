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
          role?: UserRole
          is_active?: boolean
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
          proposal_id?: number | null
          status?: ProjectStatus
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
          project_id: number
          project_number: string
          project_name: string | null
          vendor_name: string
          description: string | null
          year: number
          month: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: number
          project_id: number
          project_number: string
          project_name?: string | null
          vendor_name: string
          description?: string | null
          year: number
          month: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          project_number?: string
          project_name?: string | null
          vendor_name?: string
          description?: string | null
          year?: number
          month?: number
          amount?: number
          created_at?: string
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
