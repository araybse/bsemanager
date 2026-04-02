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

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_number')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get all phases for this project
  const { data: phases, error: phasesError } = await supabase
    .from('contract_phases')
    .select('id, phase_code, phase_name')
    .eq('project_id', projectId)

  if (phasesError) {
    return NextResponse.json({ error: phasesError.message }, { status: 500 })
  }

  // Type definitions
  type Project = { id: number; project_number: string }
  type Phase = { id: number; phase_code: string; phase_name: string }
  type Selection = { phase_id: number; included: boolean }

  // Get phase selections (or initialize defaults)
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

  // If no selections exist, initialize defaults with all C* phases
  const hasSelections = selections && selections.length > 0
  
  const selectedPhaseIds = ((phases || []) as Phase[])
    .filter(phase => {
      if (hasSelections && selectionMap.has(phase.id)) {
        return selectionMap.get(phase.id) === true
      }
      // Default to true for C* phases when no selections exist
      if (!hasSelections) {
        return phase.phase_code?.toUpperCase().startsWith('C') ?? false
      }
      return false
    })
    .map(p => p.id)
  
  // If no selections exist and we have C* phases, save the defaults
  if (!hasSelections && selectedPhaseIds.length > 0) {
    const insertData = ((phases || []) as Phase[]).map(phase => ({
      project_id: projectId,
      phase_id: phase.id,
      included: selectedPhaseIds.includes(phase.id)
    }))
    
    await supabase
      .from('project_performance_phase_selections')
      .insert(insertData as never)
  }

  if (selectedPhaseIds.length === 0) {
    return NextResponse.json({
      multiplier: null,
      selectedPhaseIds: [],
      totalRevenue: 0,
      totalLaborCost: 0
    })
  }

  const selectedPhaseNames = ((phases || []) as Phase[])
    .filter(p => selectedPhaseIds.includes(p.id))
    .map(p => (p.phase_name || '').trim().toLowerCase())

  // Get invoice revenue for selected phases
  const { data: invoiceLines, error: invoiceLinesError } = await supabase
    .from('invoice_line_items')
    .select('phase_name, amount, line_type')
    .eq('project_number', (project as Project).project_number)

  if (invoiceLinesError) {
    return NextResponse.json({ error: invoiceLinesError.message }, { status: 500 })
  }

  type InvoiceLine = { phase_name: string | null; amount: number | null; line_type: string | null }
  let totalRevenue = 0
  ;((invoiceLines || []) as InvoiceLine[]).forEach(line => {
    const phaseName = (line.phase_name || '').trim().toLowerCase()
    const lineType = (line.line_type || '').trim().toLowerCase()
    
    // Exclude reimbursables and adjustments
    if (lineType === 'reimbursable' || lineType === 'adjustment') return
    
    if (selectedPhaseNames.includes(phaseName)) {
      totalRevenue += Number(line.amount) || 0
    }
  })

  // Get labor cost for selected phases
  type TimeEntry = { phase_name: string | null; labor_cost: number | null }
  const { data: timeEntries, error: timeEntriesError } = await supabase
    .from('time_entries')
    .select('phase_name, labor_cost')
    .eq('project_number', (project as Project).project_number)

  if (timeEntriesError) {
    return NextResponse.json({ error: timeEntriesError.message }, { status: 500 })
  }

  let totalLaborCost = 0
  ;((timeEntries || []) as TimeEntry[]).forEach(entry => {
    const phaseName = (entry.phase_name || '').trim().toLowerCase()
    if (selectedPhaseNames.includes(phaseName)) {
      totalLaborCost += Number(entry.labor_cost) || 0
    }
  })

  const multiplier = totalLaborCost > 0 ? totalRevenue / totalLaborCost : null

  return NextResponse.json({
    multiplier,
    selectedPhaseIds,
    totalRevenue,
    totalLaborCost
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRoles(['admin', 'project_manager'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const projectId = parseInt(id)
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
  }

  const body = await request.json()
  const { selectedPhaseIds } = body as { selectedPhaseIds: number[] }

  if (!Array.isArray(selectedPhaseIds)) {
    return NextResponse.json({ error: 'selectedPhaseIds must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Type definitions
  type Phase = { id: number }

  // Get all phases for this project
  const { data: phases, error: phasesError } = await supabase
    .from('contract_phases')
    .select('id')
    .eq('project_id', projectId)

  if (phasesError) {
    return NextResponse.json({ error: phasesError.message }, { status: 500 })
  }

  const allPhaseIds = ((phases || []) as Phase[]).map(p => p.id)

  // Delete existing selections
  await supabase
    .from('project_performance_phase_selections')
    .delete()
    .eq('project_id', projectId)

  // Insert new selections
  const insertData = allPhaseIds.map(phaseId => ({
    project_id: projectId,
    phase_id: phaseId,
    included: selectedPhaseIds.includes(phaseId)
  }))

  const { error: insertError } = await supabase
    .from('project_performance_phase_selections')
    .insert(insertData as never)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
