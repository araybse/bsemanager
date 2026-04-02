import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { normalizeExpenseBillingStatus } from '@/lib/finance/expense-billing-status'

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



  const [invoiceLineResult, laborResult, expenseResult] = await Promise.all([
    fetchAllPages<{
      project_number: string | null
      phase_name: string | null
      amount: number | null
      line_type: string | null
    }>(async (from, to) =>
      await supabase
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
    }>(async (from, to) =>
      await supabase
        .from('time_entries')
        .select('project_number, employee_name, labor_cost, phase_name')
        .in('project_number' as never, projectNumbers as never)
        .range(from, to)
    ),
    fetchAllPages<{
      project_number: string | null
      fee_amount: number | null
      is_reimbursable: boolean | null
      status: string | null
      billing_status: string | null
      source_active: boolean | null
    }>(async (from, to) =>
      await supabase
        .from('project_expenses')
        .select('project_number, fee_amount, is_reimbursable, status, billing_status, source_active')
        .in('project_number' as never, projectNumbers as never)
        .range(from, to)
    ),
  ])

  if (invoiceLineResult.error || laborResult.error || expenseResult.error) {
    const message =
      invoiceLineResult.error?.message ||
      laborResult.error?.message ||
      expenseResult.error?.message ||
      'Failed to compute project multipliers'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const revenueByProject = new Map<string, number>()
  const laborByProject = new Map<string, number>()
  const expenseByProject = new Map<string, number>()

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
    // Total Revenue: ALL invoice line items (no exclusions)
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
    // BSE Labor: ALL time entries labor cost (no exclusions)
    laborByProject.set(key, (laborByProject.get(key) || 0) + (Number(row.labor_cost) || 0))
  })

  ;(
    (
      expenseResult.data as Array<{
        project_number: string | null
        fee_amount: number | null
        is_reimbursable: boolean | null
        status: string | null
        billing_status: string | null
        source_active: boolean | null
      }> | null
    ) || []
  ).forEach((row) => {
    if (row.source_active === false) return
    const key = (row.project_number || '').trim()
    if (!key) return
    // Total Expenses: ALL expenses fee_amount (no exclusions)
    expenseByProject.set(
      key,
      (expenseByProject.get(key) || 0) + (Number(row.fee_amount) || 0)
    )
  })

  // Calculate Project Multiplier: Total Revenue / Total Cost
  // Matches project detail dashboard cards exactly
  projectNumbers.forEach((projectNumber) => {
    const totalRevenue = revenueByProject.get(projectNumber) || 0
    const totalCost = (laborByProject.get(projectNumber) || 0) + (expenseByProject.get(projectNumber) || 0)
    multipliers[projectNumber] = totalRevenue > 0 && totalCost > 0 ? totalRevenue / totalCost : null
  })

  return NextResponse.json({ multipliers })
}
