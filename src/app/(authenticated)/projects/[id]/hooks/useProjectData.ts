import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/types/database'

type ProjectWithRelations = Tables<'projects'> & {
  clients: { name: string; address_line_1: string | null; address_line_2: string | null } | null
}

type ProjectExpenseRow = {
  id: number
  vendor_name: string | null
  source_entity_type: string
  source_entity_id: string | null
  qb_vendor_name: string | null
  expense_date: string
  description: string | null
  fee_amount: number
  markup_pct: number
  amount_to_charge: number
  is_reimbursable: boolean
  status: string
  billing_status: string | null
  invoice_number: string | null
  project_number: string | null
  subcontract_contract_id: number | null
  source_active: boolean | null
}

type SubcontractContractRow = {
  id: number
  project_number: string | null
  project_id: number | null
  vendor_name: string
  description: string | null
  original_amount: number
  status: 'active' | 'closed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  created_at: string | null
  updated_at: string | null
}

const excludedEmployees = new Set(['Morgan Wilson'])

async function fetchProjectTimeEntries(
  supabase: ReturnType<typeof createClient>,
  projectNumber: string,
  projectRowId: number
) {
  const pageSize = 1000
  const byNumber: Tables<'time_entries'>[] = []
  const byId: Tables<'time_entries'>[] = []

  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('project_number', projectNumber)
      .order('entry_date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data as Tables<'time_entries'>[]) || []
    byNumber.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('project_id', projectRowId as never)
      .order('entry_date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data as Tables<'time_entries'>[]) || []
    byId.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  const uniqueById = new Map<number, Tables<'time_entries'>>()
  ;[...byNumber, ...byId].forEach((entry) => {
    uniqueById.set(entry.id, entry)
  })
  return Array.from(uniqueById.values()).filter(
    (entry) => !excludedEmployees.has(entry.employee_name || '')
  )
}

/**
 * Custom hook for fetching project data
 * ONLY contains data fetching queries - no UI state
 */
export function useProjectData(projectId: number) {
  const supabase = createClient()

  // Fetch project details
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name, address_line_1, address_line_2)
        `)
        .eq('id', projectId)
        .single()
      if (error) throw error
      return data as ProjectWithRelations
    },
  })

  const normalizedProjectNumber = (projectQuery.data?.project_number || '').trim()

  // Fetch contract phases
  const phasesQuery = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_code')
      if (error) throw error
      return data as Tables<'contract_phases'>[]
    },
  })

  // Fetch invoices
  const invoicesQuery = useQuery({
    queryKey: ['project-invoices', normalizedProjectNumber],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'invoices'>[]
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_number', projectNumber)
        .order('date_issued', { ascending: false })
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch invoice line items
  const invoiceLineItemsQuery = useQuery({
    queryKey: ['project-invoice-line-items', projectId, invoicesQuery.data?.length || 0],
    queryFn: async () => {
      const invoiceIds = invoicesQuery.data?.map((invoice) => invoice.id) || []
      if (invoiceIds.length === 0) return [] as Tables<'invoice_line_items'>[]
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, phase_name, amount, line_type')
        .in('invoice_id', invoiceIds as never)
      if (error) throw error
      return data as Tables<'invoice_line_items'>[]
    },
    enabled: !!invoicesQuery.data,
  })

  // Fetch ALL time entries for this project
  const allTimeEntriesQuery = useQuery({
    queryKey: ['project-all-time', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'time_entries'>[]
      return fetchProjectTimeEntries(supabase, projectNumber, projectId)
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch time entries for the table
  const timeEntriesQuery = useQuery({
    queryKey: ['project-time', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'time_entries'>[]
      return fetchProjectTimeEntries(supabase, projectNumber, projectId)
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch expenses
  const expensesQuery = useQuery({
    queryKey: ['project-expenses', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) {
        return [] as ProjectExpenseRow[]
      }

      const [byNumber, byProjectId] = await Promise.all([
        supabase
          .from('project_expenses')
          .select(
            'id, source_entity_type, source_entity_id, vendor_name, expense_date, description, fee_amount, markup_pct, amount_to_charge, is_reimbursable, status, billing_status, invoice_number, project_number, subcontract_contract_id, source_active'
          )
          .eq('project_number', projectNumber)
          .neq('source_active', false)
          .order('expense_date', { ascending: false }),
        supabase
          .from('project_expenses')
          .select(
            'id, source_entity_type, source_entity_id, vendor_name, expense_date, description, fee_amount, markup_pct, amount_to_charge, is_reimbursable, status, billing_status, invoice_number, project_number, subcontract_contract_id, source_active'
          )
          .eq('project_id', projectId as never)
          .neq('source_active', false)
          .order('expense_date', { ascending: false }),
      ])

      if (byNumber.error) throw byNumber.error
      if (byProjectId.error) throw byProjectId.error

      const merged = new Map<number, ProjectExpenseRow>()
      ;[
        ...((byNumber.data as ProjectExpenseRow[] | null) || []),
        ...((byProjectId.data as ProjectExpenseRow[] | null) || []),
      ].forEach((row) => {
        merged.set(row.id, { ...row, qb_vendor_name: null })
      })

      const contractLaborRows = await supabase
        .from('contract_labor')
        .select('qb_expense_id, vendor_name')
        .or(`project_number.eq.${projectNumber},project_id.eq.${projectId}`)

      if (contractLaborRows.error) throw contractLaborRows.error

      const qbVendorByExpenseId = new Map<string, string>()
      ;((contractLaborRows.data as Array<{ qb_expense_id: string | null; vendor_name: string | null }> | null) || [])
        .forEach((row) => {
          const key = (row.qb_expense_id || '').trim()
          if (!key) return
          qbVendorByExpenseId.set(key, row.vendor_name || '')
        })

      return Array.from(merged.values())
        .map((row) => {
          if (row.source_entity_type !== 'contract_labor') return row
          return {
            ...row,
            qb_vendor_name: qbVendorByExpenseId.get((row.source_entity_id || '').trim()) || null,
          }
        })
        .sort((a, b) =>
        (b.expense_date || '').localeCompare(a.expense_date || '')
      )
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch subcontract contracts
  const subcontractContractsQuery = useQuery({
    queryKey: ['subcontract-contracts', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as SubcontractContractRow[]

      const [byNumber, byProjectId] = await Promise.all([
        supabase
          .from('subcontract_contracts' as never)
          .select('*')
          .eq('project_number' as never, projectNumber as never)
          .order('created_at' as never, { ascending: false }),
        supabase
          .from('subcontract_contracts' as never)
          .select('*')
          .eq('project_id' as never, projectId as never)
          .order('created_at' as never, { ascending: false }),
      ])
      if (byNumber.error) throw byNumber.error
      if (byProjectId.error) throw byProjectId.error

      const merged = new Map<number, SubcontractContractRow>()
      ;[
        ...((byNumber.data as SubcontractContractRow[] | null) || []),
        ...((byProjectId.data as SubcontractContractRow[] | null) || []),
      ].forEach((row) => merged.set(row.id, row))
      return Array.from(merged.values()).sort(
        (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
      )
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch team assignments
  const teamAssignmentsQuery = useQuery({
    queryKey: ['project-team', projectId],
    queryFn: async () => {
      if (!projectId) {
        return []
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('project_team_assignments')
        .select(`
          id,
          user_id,
          role,
          assigned_at,
          profiles (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('project_id', projectId)
        .order('assigned_at', { ascending: false })
      if (error) {
        throw error
      }
      return data as Array<{
        id: number
        user_id: string
        role: string
        assigned_at: string
        profiles: {
          id: string
          full_name: string
          email: string
          role: string
        } | null
      }>
    },
  })

  return {
    // Project
    project: projectQuery.data,
    isLoadingProject: projectQuery.isLoading,
    normalizedProjectNumber,
    
    // Phases
    phases: phasesQuery.data,
    isLoadingPhases: phasesQuery.isLoading,
    
    // Invoices
    invoices: invoicesQuery.data,
    isLoadingInvoices: invoicesQuery.isLoading,
    invoiceLineItems: invoiceLineItemsQuery.data,
    
    // Time
    allTimeEntries: allTimeEntriesQuery.data,
    isLoadingAllTime: allTimeEntriesQuery.isLoading,
    timeEntries: timeEntriesQuery.data,
    isLoadingTime: timeEntriesQuery.isLoading,
    
    // Expenses
    expenses: expensesQuery.data,
    isLoadingExpenses: expensesQuery.isLoading,
    
    // Contracts
    subcontractContracts: subcontractContractsQuery.data,
    isLoadingSubcontractContracts: subcontractContractsQuery.isLoading,
    
    // Team
    teamAssignments: teamAssignmentsQuery.data,
    isLoadingTeam: teamAssignmentsQuery.isLoading,
  }
}
