import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

const PAGE_SIZE = 1000

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown | null }>
): Promise<{ data: T[]; error: unknown | null }> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) return { data: rows, error }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { data: rows, error: null }
}

/**
 * GET /api/dashboard/summary-metrics
 * 
 * Returns 4 key metrics for the dashboard:
 * - Total Contract: Sum of all contract phase amounts
 * - Total Revenue: Sum of all invoices (including reimbursables)
 * - Total Cost: Sum of all labor cost + all expenses
 * - Performance Multiplier: (C-phase revenue - Morgan Wilson billed revenue) / (BSE labor cost + non-reimbursable expenses)
 */
export async function GET() {
  const auth = await requireApiRoles(['admin', 'project_manager'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  try {
    // 1. Total Contract Value
    const { data: contractPhases } = await supabase
      .from('contract_phases')
      .select('amount')
    
    const totalContract = (contractPhases || []).reduce((sum, phase) => sum + (Number((phase as { amount: number }).amount) || 0), 0)

    // 2. Total Revenue (all invoices)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount')
    
    const totalRevenue = (invoices || []).reduce((sum, inv) => sum + (Number((inv as { amount: number }).amount) || 0), 0)

    // 3. Total Cost (labor + expenses) - fetch with pagination
    const { data: timeEntries } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('time_entries')
        .select('labor_cost')
        .range(from, to)
      return { data: result.data, error: result.error }
    })
    
    const { data: expenses } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('expenses')
        .select('amount')
        .range(from, to)
      return { data: result.data, error: result.error }
    })

    const totalLaborCost = (timeEntries || []).reduce((sum, entry) => sum + (Number((entry as { labor_cost: number }).labor_cost) || 0), 0)
    const totalExpenses = (expenses || []).reduce((sum, exp) => sum + (Number((exp as { amount: number }).amount) || 0), 0)
    const totalCost = totalLaborCost + totalExpenses

    // 4. Performance Multiplier
    // Numerator: C-phase invoice revenue - Morgan Wilson billed revenue
    // Denominator: BSE employee labor cost + non-reimbursable expenses

    // Get Morgan Wilson's profile ID
    const { data: morganProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'mwilson@blackstoneeng.com')
      .single()

    const morganUserId = (morganProfile as { id: string } | null)?.id

    // Fetch all contract phases to map project_id + phase_name → phase_code
    const { data: allPhases } = await supabase
      .from('contract_phases')
      .select('project_id, phase_code, phase_name')

    const phaseCodeMap = new Map<string, string>()
    ;(allPhases || []).forEach((phase: { project_id: number; phase_code: string; phase_name: string }) => {
      const key = `${phase.project_id}::${(phase.phase_name || '').trim().toLowerCase()}`
      phaseCodeMap.set(key, (phase.phase_code || '').trim())
    })

    // Fetch invoice line items with pagination
    const { data: allInvoiceLines } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('invoice_line_items')
        .select('project_number, phase_name, amount')
        .range(from, to)
      return { data: result.data, error: result.error }
    })

    // Map project_number → project_id
    const projectNumbers = Array.from(new Set((allInvoiceLines || []).map((inv: { project_number: string }) => inv.project_number).filter(Boolean)))
    const { data: projects } = await supabase
      .from('projects')
      .select('id, project_number')
      .in('project_number', projectNumbers)

    const projectNumberToId = new Map<string, number>()
    ;(projects || []).forEach((proj: { id: number; project_number: string }) => {
      projectNumberToId.set(proj.project_number, proj.id)
    })

    // Calculate C-phase revenue
    let cPhaseRevenue = 0
    ;(allInvoiceLines || []).forEach((line: { project_number: string; phase_name: string; amount: number }) => {
      const projectId = projectNumberToId.get(line.project_number)
      if (!projectId) return

      const key = `${projectId}::${(line.phase_name || '').trim().toLowerCase()}`
      const phaseCode = phaseCodeMap.get(key)

      if (phaseCode && phaseCode.startsWith('C')) {
        cPhaseRevenue += Number(line.amount) || 0
      }
    })

    // Calculate Morgan Wilson's billed revenue (hours × billable rate)
    let morganRevenue = 0
    if (morganUserId) {
      const { data: morganTimeEntries } = await fetchAllPages(async (from, to) => {
        const result = await supabase
          .from('time_entries')
          .select('project_id, phase_name, hours')
          .eq('user_id', morganUserId)
          .range(from, to)
        return { data: result.data, error: result.error }
      })

      // Get billing rates
      const { data: billingRates } = await supabase
        .from('billable_rates')
        .select('employee_type, hourly_rate')

      const typedRates = (billingRates || []) as Array<{ employee_type: string; hourly_rate: number }>
      const projectInspectorRate = typedRates.find((rate) => 
        rate.employee_type === 'Project Inspector'
      )?.hourly_rate || 0

      ;(morganTimeEntries || []).forEach((entry: { project_id: number; phase_name: string; hours: number }) => {
        const key = `${entry.project_id}::${(entry.phase_name || '').trim().toLowerCase()}`
        const phaseCode = phaseCodeMap.get(key)

        if (phaseCode && phaseCode.startsWith('C')) {
          morganRevenue += (Number(entry.hours) || 0) * projectInspectorRate
        }
      })
    }

    // Performance Multiplier numerator
    const performanceNumerator = cPhaseRevenue - morganRevenue

    // Performance Multiplier denominator: BSE labor cost + non-reimbursable expenses
    // (Morgan's labor_cost is already $0, so totalLaborCost excludes him)
    const { data: reimbursableExpenses } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('expenses')
        .select('amount')
        .eq('billing_status', 'Reimbursable')
        .range(from, to)
      return { data: result.data, error: result.error }
    })

    const totalReimbursable = (reimbursableExpenses || []).reduce((sum, exp) => sum + (Number((exp as { amount: number }).amount) || 0), 0)
    const nonReimbursableExpenses = totalExpenses - totalReimbursable
    const performanceDenominator = totalLaborCost + nonReimbursableExpenses

    const performanceMultiplier = performanceDenominator > 0 ? performanceNumerator / performanceDenominator : null

    return NextResponse.json({
      totalContract,
      totalRevenue,
      totalCost,
      performanceMultiplier,
    })
  } catch (error) {
    console.error('Summary metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch summary metrics' },
      { status: 500 }
    )
  }
}
