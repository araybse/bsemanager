import { config as loadEnv } from 'dotenv'
import { describe, expect, it } from 'vitest'
import { createAdminClient } from '../supabase/admin'

loadEnv({ path: '.env.local' })

const HAS_SUPABASE_ENV =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const COMPANY_START_MONTH = '2023-05'

type SnapshotRow = {
  id: number
  period_start: string
  period_end: string
  fetched_at: string
}

type SnapshotLineRow = {
  snapshot_id: number
  account_name: string | null
  amount: number | null
  is_total: boolean | null
}

type ContractLaborExpenseRow = {
  expense_date: string
  fee_amount: number | null
}

function toMonth(value: string | null | undefined) {
  if (!value || value.length < 7) return ''
  return value.slice(0, 7)
}

describe.runIf(HAS_SUPABASE_ENV)('QBO sync integrity checks', () => {
  it('has populated QBO sync timestamps', async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('qb_settings' as never)
      .select(
        'last_invoice_sync_at, last_customer_sync_at, last_project_sync_at, last_time_sync_at, last_contract_labor_sync_at, last_payment_sync_at'
      )
      .limit(1)
      .maybeSingle()
    if (error) throw error
    expect(data).toBeTruthy()
    expect(data?.last_invoice_sync_at).toBeTruthy()
    expect(data?.last_customer_sync_at).toBeTruthy()
    expect(data?.last_project_sync_at).toBeTruthy()
    expect(data?.last_time_sync_at).toBeTruthy()
    expect(data?.last_contract_labor_sync_at).toBeTruthy()
    expect(data?.last_payment_sync_at).toBeTruthy()
  })

  it('keeps synced time entries and invoice linkage consistent', async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('time_entries' as never)
      .select('qb_time_id, is_billed, invoice_id')
    if (error) throw error

    const rows =
      ((data as Array<{ qb_time_id: string | null; is_billed: boolean | null; invoice_id: number | null }> | null) ||
        [])

    expect(rows.length).toBeGreaterThan(0)

    const missingQboIdCount = rows.filter((row) => !row.qb_time_id).length
    const billedWithoutInvoiceCount = rows.filter((row) => Boolean(row.is_billed) && !row.invoice_id).length

    expect(missingQboIdCount).toBe(0)
    expect(billedWithoutInvoiceCount).toBe(0)
  })

  it('keeps invoice headers aligned with line item totals', async () => {
    const supabase = createAdminClient()

    const [{ data: invoiceRows, error: invoiceError }, { data: lineRows, error: lineError }] =
      await Promise.all([
        supabase.from('invoices' as never).select('id, amount'),
        supabase.from('invoice_line_items' as never).select('invoice_id, amount'),
      ])
    if (invoiceError) throw invoiceError
    if (lineError) throw lineError

    const invoiceAmountById = new Map<number, number>()
    ;((invoiceRows as Array<{ id: number; amount: number | null }> | null) || []).forEach((row) => {
      invoiceAmountById.set(row.id, Number(row.amount) || 0)
    })

    const lineSumByInvoiceId = new Map<number, number>()
    ;((lineRows as Array<{ invoice_id: number; amount: number | null }> | null) || []).forEach((row) => {
      lineSumByInvoiceId.set(
        row.invoice_id,
        (lineSumByInvoiceId.get(row.invoice_id) || 0) + (Number(row.amount) || 0)
      )
    })

    const mismatches = Array.from(invoiceAmountById.entries()).filter(([invoiceId, headerAmount]) => {
      const lineSum = lineSumByInvoiceId.get(invoiceId) || 0
      return Math.abs(headerAmount - lineSum) > 0.01
    })

    expect(mismatches).toEqual([])
  })

  it('matches monthly Contract Labor totals between P&L and schedule source data', async () => {
    const supabase = createAdminClient()

    const { data: snapshotRows, error: snapshotError } = await supabase
      .from('accounting_snapshots' as never)
      .select('id, period_start, period_end, fetched_at')
      .eq('report_type' as never, 'profit_and_loss' as never)
      .eq('basis' as never, 'cash' as never)
      .gte('period_start' as never, `${COMPANY_START_MONTH}-01` as never)
      .order('fetched_at', { ascending: false })
    if (snapshotError) throw snapshotError

    const latestSnapshotByMonth = new Map<string, SnapshotRow>()
    ;((snapshotRows as SnapshotRow[] | null) || []).forEach((row) => {
      const startMonth = toMonth(row.period_start)
      const endMonth = toMonth(row.period_end)
      if (!startMonth || startMonth !== endMonth) return
      if (!latestSnapshotByMonth.has(startMonth)) {
        latestSnapshotByMonth.set(startMonth, row)
      }
    })

    const snapshotIds = Array.from(latestSnapshotByMonth.values()).map((row) => row.id)
    const { data: lineRows, error: lineError } = await supabase
      .from('accounting_snapshot_lines' as never)
      .select('snapshot_id, account_name, amount, is_total')
      .in('snapshot_id' as never, snapshotIds as never)
    if (lineError) throw lineError

    const monthBySnapshotId = new Map<number, string>()
    latestSnapshotByMonth.forEach((row, month) => monthBySnapshotId.set(row.id, month))

    const pnlByMonth = new Map<string, number>()
    ;((lineRows as SnapshotLineRow[] | null) || []).forEach((line) => {
      const month = monthBySnapshotId.get(line.snapshot_id)
      if (!month) return
      const accountName = (line.account_name || '').trim().toLowerCase()
      const isContractLabor = accountName.includes('contract labor') && !accountName.startsWith('total ')
      if (!isContractLabor) return
      if (line.is_total) return
      pnlByMonth.set(month, (pnlByMonth.get(month) || 0) + (Number(line.amount) || 0))
    })

    const { data: expenseRows, error: expenseError } = await supabase
      .from('project_expenses' as never)
      .select('expense_date, fee_amount')
      .eq('source_entity_type' as never, 'contract_labor' as never)
      .eq('is_reimbursable' as never, false as never)
      .neq('source_active' as never, false as never)
      .gte('expense_date' as never, `${COMPANY_START_MONTH}-01` as never)
    if (expenseError) throw expenseError

    const scheduleByMonth = new Map<string, number>()
    ;((expenseRows as ContractLaborExpenseRow[] | null) || []).forEach((row) => {
      const month = toMonth(row.expense_date)
      if (!month) return
      scheduleByMonth.set(month, (scheduleByMonth.get(month) || 0) + (Number(row.fee_amount) || 0))
    })

    const deltas = Array.from(latestSnapshotByMonth.keys()).map((month) => {
      const pnl = Number((pnlByMonth.get(month) || 0).toFixed(2))
      const schedule = Number((scheduleByMonth.get(month) || 0).toFixed(2))
      return { month, delta: Number((schedule - pnl).toFixed(2)) }
    })

    const mismatches = deltas.filter((row) => row.delta !== 0)
    expect(mismatches).toEqual([])
  })

  it('has monthly Balance Sheet coverage across the same historical window', async () => {
    const supabase = createAdminClient()

    const { data: pnlSnapshots, error: pnlError } = await supabase
      .from('accounting_snapshots' as never)
      .select('period_start, fetched_at')
      .eq('report_type' as never, 'profit_and_loss' as never)
      .eq('basis' as never, 'cash' as never)
      .gte('period_start' as never, `${COMPANY_START_MONTH}-01` as never)
      .order('fetched_at', { ascending: false })
    if (pnlError) throw pnlError

    const { data: bsSnapshots, error: bsError } = await supabase
      .from('accounting_snapshots' as never)
      .select('period_end, fetched_at')
      .eq('report_type' as never, 'balance_sheet' as never)
      .gte('period_end' as never, `${COMPANY_START_MONTH}-01` as never)
      .order('fetched_at', { ascending: false })
    if (bsError) throw bsError

    const pnlMonths = new Set<string>()
    ;((pnlSnapshots as Array<{ period_start: string }> | null) || []).forEach((row) => {
      const month = toMonth(row.period_start)
      if (month) pnlMonths.add(month)
    })

    const bsMonths = new Set<string>()
    ;((bsSnapshots as Array<{ period_end: string }> | null) || []).forEach((row) => {
      const month = toMonth(row.period_end)
      if (month) bsMonths.add(month)
    })

    const missingBalanceSheetMonths = Array.from(pnlMonths).filter((month) => !bsMonths.has(month))
    expect(missingBalanceSheetMonths).toEqual([])
  })
})

