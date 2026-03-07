import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

type MultiplierResponse = Record<string, number | null>

const PAGE_SIZE = 1000

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
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

export async function GET(request: NextRequest) {
  const auth = await requireApiRoles(['admin', 'project_manager', 'employee', 'client'])
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const projectNumbersParam = request.nextUrl.searchParams.get('project_numbers') || ''
  const projectNumbers = projectNumbersParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (!projectNumbers.length) {
    return NextResponse.json({ multipliers: {} as MultiplierResponse })
  }

  const multipliers: MultiplierResponse = {}
  projectNumbers.forEach((projectNumber) => {
    multipliers[projectNumber] = null
  })

  const projectResult = await supabase
    .from('projects')
    .select('id, project_number')
    .in('project_number' as never, projectNumbers as never)

  if (projectResult.error) {
    return NextResponse.json({ error: projectResult.error.message }, { status: 500 })
  }

  const projectRows =
    (projectResult.data as Array<{ id: number; project_number: string | null }> | null) || []
  const projectIdByNumber = new Map<string, number>()
  const projectIds: number[] = []
  projectRows.forEach((row) => {
    const key = (row.project_number || '').trim()
    if (!key || !Number.isFinite(row.id)) return
    projectIdByNumber.set(key, row.id)
    projectIds.push(row.id)
  })

  const [phaseResult, invoiceLineResult, laborResult, expenseResult] = await Promise.all([
    projectIds.length
      ? fetchAllPages<{ project_id: number | null; phase_code: string | null; phase_name: string | null }>(
          (from, to) =>
            supabase
              .from('contract_phases')
              .select('project_id, phase_code, phase_name')
              .in('project_id' as never, projectIds as never)
              .range(from, to)
        )
      : Promise.resolve({ data: [], error: null } as const),
    fetchAllPages<{
      project_number: string | null
      phase_name: string | null
      amount: number | null
      line_type: string | null
    }>((from, to) =>
      supabase
        .from('invoice_line_items')
        .select('project_number, phase_name, amount, line_type')
        .in('project_number' as never, projectNumbers as never)
        .range(from, to)
    ),
    fetchAllPages<{
      project_number: string | null
      employee_name: string | null
      labor_cost: number | null
      phase_name: string | null
    }>((from, to) =>
      supabase
        .from('time_entries')
        .select('project_number, employee_name, labor_cost, phase_name')
        .in('project_number' as never, projectNumbers as never)
        .range(from, to)
    ),
    fetchAllPages<{
      project_number: string | null
      fee_amount: number | null
      is_reimbursable: boolean | null
    }>((from, to) =>
      supabase
        .from('project_expenses')
        .select('project_number, fee_amount, is_reimbursable')
        .in('project_number' as never, projectNumbers as never)
        .range(from, to)
    ),
  ])

  if (phaseResult.error || invoiceLineResult.error || laborResult.error || expenseResult.error) {
    const message =
      phaseResult.error?.message ||
      invoiceLineResult.error?.message ||
      laborResult.error?.message ||
      expenseResult.error?.message ||
      'Failed to compute project multipliers'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const revenueByProject = new Map<string, number>()
  const laborByProject = new Map<string, number>()
  const nonReimbExpenseByProject = new Map<string, number>()

  const zReimPhaseNamesByProject = new Map<string, Set<string>>()
  ;(
    (phaseResult.data as Array<{ project_id: number | null; phase_code: string | null; phase_name: string | null }> | null) ||
    []
  ).forEach((row) => {
    const projectNumber = row.project_id ? projectRows.find((p) => p.id === row.project_id)?.project_number || '' : ''
    const key = projectNumber.trim()
    const phaseCode = (row.phase_code || '').trim().toLowerCase()
    const phaseName = (row.phase_name || '').trim().toLowerCase()
    if (!key || !phaseCode || !phaseName) return
    if (phaseCode !== 'zreim') return
    if (!zReimPhaseNamesByProject.has(key)) zReimPhaseNamesByProject.set(key, new Set())
    zReimPhaseNamesByProject.get(key)!.add(phaseName)
  })

  ;(
    (
      invoiceLineResult.data as Array<{
        project_number: string | null
        phase_name: string | null
        amount: number | null
        line_type: string | null
      }> | null
    ) ||
    []
  ).forEach((row) => {
    const key = (row.project_number || '').trim()
    if (!key) return
    const lineType = (row.line_type || '').trim().toLowerCase()
    if (lineType === 'reimbursable' || lineType === 'adjustment') return
    const phaseName = (row.phase_name || '').trim().toLowerCase()
    const zReimNames = zReimPhaseNamesByProject.get(key)
    const isZReimPhase =
      phaseName === 'zreim' ||
      phaseName.startsWith('zreim') ||
      phaseName.includes('reimburs') ||
      Boolean(zReimNames?.has(phaseName))
    if (isZReimPhase) return
    revenueByProject.set(key, (revenueByProject.get(key) || 0) + (Number(row.amount) || 0))
  })

  ;(
    (
      laborResult.data as Array<{
        project_number: string | null
        employee_name: string | null
        labor_cost: number | null
        phase_name: string | null
      }> | null
    ) ||
    []
  ).forEach((row) => {
    const key = (row.project_number || '').trim()
    if (!key) return
    if ((row.employee_name || '').trim().toLowerCase() === 'morgan wilson') return
    const phaseName = (row.phase_name || '').trim().toLowerCase()
    const zReimNames = zReimPhaseNamesByProject.get(key)
    const isZReimPhase =
      phaseName === 'zreim' ||
      phaseName.startsWith('zreim') ||
      phaseName.includes('reimburs') ||
      Boolean(zReimNames?.has(phaseName))
    if (isZReimPhase) return
    laborByProject.set(key, (laborByProject.get(key) || 0) + (Number(row.labor_cost) || 0))
  })

  ;(
    (
      expenseResult.data as Array<{
        project_number: string | null
        fee_amount: number | null
        is_reimbursable: boolean | null
      }> | null
    ) || []
  ).forEach((row) => {
    const key = (row.project_number || '').trim()
    if (!key) return
    if (row.is_reimbursable) return
    nonReimbExpenseByProject.set(
      key,
      (nonReimbExpenseByProject.get(key) || 0) + (Number(row.fee_amount) || 0)
    )
  })

  projectNumbers.forEach((projectNumber) => {
    const revenue = revenueByProject.get(projectNumber) || 0
    const cost = (laborByProject.get(projectNumber) || 0) + (nonReimbExpenseByProject.get(projectNumber) || 0)
    multipliers[projectNumber] = revenue > 0 && cost > 0 ? revenue / cost : null
  })

  return NextResponse.json({ multipliers })
}
