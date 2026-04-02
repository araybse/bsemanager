import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const projectId = parseInt(id)
  
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Type definitions
  type Project = { id: number; project_number: string }
  type Phase = { id: number; phase_code: string; phase_name: string }
  type Selection = { phase_id: number; included: boolean }
  type InvoiceLine = { phase_name: string | null; amount: number | null; line_type: string | null; invoice_date: string | null }
  type TimeEntry = { phase_name: string | null; labor_cost: number | null; entry_date: string | null }

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_number')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get phase selections
  const { data: phases, error: phasesError} = await supabase
    .from('contract_phases')
    .select('id, phase_code, phase_name')
    .eq('project_id', projectId)

  if (phasesError) {
    return NextResponse.json({ error: phasesError.message }, { status: 500 })
  }

  const { data: selections, error: selectionsError } = await supabase
    .from('project_performance_phase_selections')
    .select('phase_id, included')
    .eq('project_id', projectId)

  if (selectionsError) {
    return NextResponse.json({ error: selectionsError.message }, { status: 500 })
  }

  const selectionMap = new Map(
    ((selections || []) as Selection[]).map(s => [s.phase_id, s.included])
  )

  // Determine selected phases (default to C* if no selections)
  const hasSelections = selections && selections.length > 0
  const selectedPhaseIds = ((phases || []) as Phase[])
    .filter(phase => {
      if (hasSelections && selectionMap.has(phase.id)) {
        return selectionMap.get(phase.id) === true
      }
      if (!hasSelections) {
        return phase.phase_code?.toUpperCase().startsWith('C') ?? false
      }
      return false
    })
    .map(p => p.id)

  if (selectedPhaseIds.length === 0) {
    return NextResponse.json({ history: [] })
  }

  const selectedPhaseNames = ((phases || []) as Phase[])
    .filter(p => selectedPhaseIds.includes(p.id))
    .map(p => (p.phase_name || '').trim().toLowerCase())

  // Get all invoice lines with dates
  const { data: invoiceLines, error: invoiceLinesError } = await supabase
    .from('invoice_line_items')
    .select('phase_name, amount, line_type, invoice_date')
    .eq('project_number', (project as Project).project_number)
    .not('invoice_date', 'is', null)
    .order('invoice_date', { ascending: true })

  if (invoiceLinesError) {
    return NextResponse.json({ error: invoiceLinesError.message }, { status: 500 })
  }

  // Get all time entries with dates
  const { data: timeEntries, error: timeEntriesError } = await supabase
    .from('time_entries')
    .select('phase_name, labor_cost, entry_date')
    .eq('project_number', (project as Project).project_number)
    .not('entry_date', 'is', null)
    .order('entry_date', { ascending: true })

  if (timeEntriesError) {
    return NextResponse.json({ error: timeEntriesError.message }, { status: 500 })
  }

  // Build monthly cumulative data
  const monthlyData = new Map<string, { revenue: number; cost: number }>()

  // Process invoices
  ;((invoiceLines || []) as InvoiceLine[]).forEach(line => {
    const phaseName = (line.phase_name || '').trim().toLowerCase()
    if (!selectedPhaseNames.includes(phaseName)) return
    
    const lineType = (line.line_type || '').trim().toLowerCase()
    if (lineType === 'reimbursable' || lineType === 'adjustment') return
    
    const date = new Date(line.invoice_date!)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: 0, cost: 0 })
    }
    
    monthlyData.get(monthKey)!.revenue += Number(line.amount) || 0
  })

  // Process time entries
  ;((timeEntries || []) as TimeEntry[]).forEach(entry => {
    const phaseName = (entry.phase_name || '').trim().toLowerCase()
    if (!selectedPhaseNames.includes(phaseName)) return
    
    const date = new Date(entry.entry_date!)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: 0, cost: 0 })
    }
    
    monthlyData.get(monthKey)!.cost += Number(entry.labor_cost) || 0
  })

  // Sort months and calculate cumulative
  const sortedMonths = Array.from(monthlyData.keys()).sort()
  
  let cumulativeRevenue = 0
  let cumulativeCost = 0
  
  const history = sortedMonths.map(monthKey => {
    const data = monthlyData.get(monthKey)!
    cumulativeRevenue += data.revenue
    cumulativeCost += data.cost
    
    const multiplier = cumulativeCost > 0 ? cumulativeRevenue / cumulativeCost : null
    
    // Format month label (e.g., "Jan '26")
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    const yearShort = year.slice(-2)
    const monthLabel = `${monthName} '${yearShort}`
    
    return {
      month: monthKey,
      monthLabel,
      cumulativeRevenue,
      cumulativeCost,
      multiplier
    }
  })

  return NextResponse.json({ history })
}
