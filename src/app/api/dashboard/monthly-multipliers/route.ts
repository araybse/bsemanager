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
 * GET /api/dashboard/monthly-multipliers
 * 
 * Returns monthly multiplier data (revenue / cost) for C* phases only,
 * aggregated by month for the last 12 months.
 * 
 * Filters:
 * - Only contract phases where phase_code starts with 'C'
 * - Revenue from invoice_line_items
 * - Cost from time_entries (labor_cost)
 * 
 * Returns: Array<{ month: string, revenue: number, cost: number, multiplier: number | null }>
 */
export async function GET() {
  const auth = await requireApiRoles(['admin', 'project_manager'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  // Calculate date range: last 12 months including current month
  // We need current month invoices because they represent prior-month work
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const firstMonth = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 12, 1)
  const sinceDate = firstMonth.toISOString().slice(0, 10)
  const nextMonthStartDate = nextMonthStart.toISOString().slice(0, 10)

  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
    return monthKey(monthDate)
  })

  try {
    // Fetch all contract phases to build a map of project_id + phase_name → phase_code
    const { data: contractPhases, error: phasesError } = await supabase
      .from('contract_phases')
      .select('id, project_id, phase_code, phase_name')

    if (phasesError) throw phasesError

    // Build map: "projectId::phaseName" → phase_code
    const phaseCodeMap = new Map<string, string>()
    const typedPhases = (contractPhases || []) as Array<{
      id: number
      project_id: number
      phase_code: string
      phase_name: string
    }>
    
    typedPhases.forEach((phase) => {
      const key = `${phase.project_id}::${(phase.phase_name || '').trim().toLowerCase()}`
      phaseCodeMap.set(key, (phase.phase_code || '').trim())
    })

    // Fetch invoice line items for the date range (including current month) with pagination
    const { data: invoiceLines, error: invoiceError } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('invoice_line_items')
        .select('project_number, phase_name, amount, invoice_date')
        .gte('invoice_date', sinceDate)
        .lt('invoice_date', nextMonthStartDate)
        .order('invoice_date', { ascending: true })
        .range(from, to)
      return { data: result.data, error: result.error }
    })

    if (invoiceError) throw invoiceError

    // Fetch time entries for the date range (including current month) with pagination
    const { data: timeEntries, error: timeError } = await fetchAllPages(async (from, to) => {
      const result = await supabase
        .from('time_entries')
        .select('project_id, project_number, phase_name, labor_cost, entry_date')
        .gte('entry_date', sinceDate)
        .lt('entry_date', nextMonthStartDate)
        .order('entry_date', { ascending: true })
        .range(from, to)
      return { data: result.data, error: result.error }
    })

    if (timeError) throw timeError

    // Build project_number → project_id mapping
    const projectNumberToId = new Map<string, number>()
    const uniqueProjectNumbers = Array.from(
      new Set((invoiceLines || []).map((inv: { project_number?: string }) => inv.project_number).filter(Boolean))
    )
    
    if (uniqueProjectNumbers.length > 0) {
      const { data: projectMappings } = await supabase
        .from('projects')
        .select('id, project_number')
        .in('project_number', uniqueProjectNumbers as string[])
      
      ;(projectMappings || []).forEach((proj: { id: number; project_number: string }) => {
        projectNumberToId.set(proj.project_number, proj.id)
      })
    }

    // Build revenue and cost buckets by month (only C* phases)
    const revenueBuckets = new Map<string, number>()
    const costBuckets = new Map<string, number>()

    const typedInvoiceLines = (invoiceLines || []) as Array<{
      project_number: string
      phase_name: string
      amount: number
      invoice_date: string
    }>

    // Process invoice lines
    typedInvoiceLines.forEach((line) => {
      const projectId = projectNumberToId.get(line.project_number)
      if (!projectId) return

      const key = `${projectId}::${(line.phase_name || '').trim().toLowerCase()}`
      const phaseCode = phaseCodeMap.get(key)

      // Only include if phase_code starts with 'C'
      if (!phaseCode || !phaseCode.startsWith('C')) return

      // Invoice month represents prior-month work, so map invoice date to service month
      const invoiceDate = line.invoice_date ? new Date(`${line.invoice_date}T00:00:00`) : null
      if (!invoiceDate || Number.isNaN(invoiceDate.getTime())) return

      const serviceMonth = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() - 1, 1)
      const month = monthKey(serviceMonth)
      if (!month) return

      revenueBuckets.set(month, (revenueBuckets.get(month) || 0) + (Number(line.amount) || 0))
    })

    const typedTimeEntries = (timeEntries || []) as Array<{
      project_id: number
      project_number: string
      phase_name: string
      labor_cost: number
      entry_date: string
    }>

    // Process time entries
    typedTimeEntries.forEach((entry) => {
      if (!entry.project_id) return

      const key = `${entry.project_id}::${(entry.phase_name || '').trim().toLowerCase()}`
      const phaseCode = phaseCodeMap.get(key)

      // Only include if phase_code starts with 'C'
      if (!phaseCode || !phaseCode.startsWith('C')) return

      const month = (entry.entry_date || '').slice(0, 7)
      if (!month) return

      costBuckets.set(month, (costBuckets.get(month) || 0) + (Number(entry.labor_cost) || 0))
    })

    // Build response
    const monthlyData = months.map((month) => {
      const revenue = revenueBuckets.get(month) || 0
      const cost = costBuckets.get(month) || 0
      const multiplier = revenue > 0 && cost > 0 ? revenue / cost : null

      const [yearStr, monthStr] = month.split('-')
      const year = Number(yearStr)
      const monthNum = Number(monthStr)
      const date = new Date(year, monthNum - 1, 1)
      const shortMonth = date.toLocaleString('en-US', { month: 'short' })
      const monthLabel = `${shortMonth} '${String(year).slice(-2)}`

      return {
        month,
        monthLabel,
        revenue,
        cost,
        multiplier,
      }
    })

    return NextResponse.json({ monthlyMultipliers: monthlyData })
  } catch (error) {
    console.error('Monthly multipliers error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch monthly multipliers' },
      { status: 500 }
    )
  }
}
