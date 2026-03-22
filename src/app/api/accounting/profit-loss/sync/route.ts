import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'
import { refreshTokenIfNeeded } from '@/lib/qbo/sync/qbo-client'

type ProfitLossLine = {
  section: string | null
  account_name: string
  account_ref: string | null
  amount: number
  sort_order: number
  depth: number
  is_total: boolean
  parent_key: string | null
  row_key: string | null
}

type QboColData = {
  value?: string
  id?: string
}

type QboReportRow = {
  Header?: { ColData?: QboColData[] }
  Summary?: { ColData?: QboColData[] }
  ColData?: QboColData[]
  Rows?: { Row?: QboReportRow[] }
  type?: string
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,\s]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstValue(colData: QboColData[] | undefined, index: number): string {
  return String(colData?.[index]?.value || '').trim()
}

function flattenRows(
  rows: QboReportRow[] | undefined,
  options: {
    section: string | null
    depth: number
    parentKey: string | null
    sortState: { value: number }
  }
): ProfitLossLine[] {
  if (!rows?.length) return []

  const lines: ProfitLossLine[] = []
  for (const row of rows) {
    const headerTitle = firstValue(row.Header?.ColData, 0) || null
    const nextSection = options.section || headerTitle
    const nextParentKey = headerTitle || options.parentKey

    if (row.ColData?.length) {
      const accountName = firstValue(row.ColData, 0)
      if (accountName) {
        options.sortState.value += 1
        lines.push({
          section: nextSection,
          account_name: accountName,
          account_ref: row.ColData?.[0]?.id || null,
          amount: parseAmount(firstValue(row.ColData, 1)),
          sort_order: options.sortState.value,
          depth: options.depth,
          is_total: accountName.toLowerCase().startsWith('total '),
          parent_key: options.parentKey,
          row_key: accountName,
        })
      }
    }

    if (row.Summary?.ColData?.length) {
      const summaryName = firstValue(row.Summary.ColData, 0)
      if (summaryName) {
        options.sortState.value += 1
        lines.push({
          section: nextSection,
          account_name: summaryName,
          account_ref: row.Summary.ColData?.[0]?.id || null,
          amount: parseAmount(firstValue(row.Summary.ColData, 1)),
          sort_order: options.sortState.value,
          depth: options.depth,
          is_total: true,
          parent_key: nextParentKey,
          row_key: summaryName,
        })
      }
    }

    if (row.Rows?.Row?.length) {
      lines.push(
        ...flattenRows(row.Rows.Row, {
          section: nextSection,
          depth: options.depth + 1,
          parentKey: nextParentKey,
          sortState: options.sortState,
        })
      )
    }
  }
  return lines
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRoles(['admin'])
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const periodStart = String(body?.period_start || '').trim()
    const periodEnd = String(body?.period_end || '').trim()
    const basisRaw = String(body?.basis || 'accrual').toLowerCase()
    const basis = basisRaw === 'cash' ? 'cash' : 'accrual'

    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return NextResponse.json(
        { error: 'period_start and period_end must be YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const settings = await refreshTokenIfNeeded(supabase)

    const query = new URLSearchParams({
      start_date: periodStart,
      end_date: periodEnd,
      accounting_method: basis === 'cash' ? 'Cash' : 'Accrual',
      minorversion: '70',
    })

    const url = `https://quickbooks.api.intuit.com/v3/company/${settings.realm_id}/reports/ProfitAndLoss?${query.toString()}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QBO ProfitAndLoss API error ${response.status}: ${errorText}`)
    }

    const reportPayload = await response.json()
    const reportRows = ((reportPayload?.Rows?.Row as QboReportRow[] | undefined) || [])
    const lines = flattenRows(reportRows, {
      section: null,
      depth: 1,
      parentKey: null,
      sortState: { value: 0 },
    }).filter((line) => line.account_name)

    const { data: snapshot, error: snapshotError } = await supabase
      .from('accounting_snapshots' as never)
      .insert({
        report_type: 'profit_and_loss',
        period_start: periodStart,
        period_end: periodEnd,
        basis,
        raw_payload: reportPayload,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .select('id, report_type, period_start, period_end, basis, fetched_at')
      .single()
    if (snapshotError || !snapshot) {
      throw snapshotError || new Error('Failed to persist accounting snapshot')
    }

    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('accounting_snapshot_lines' as never).insert(
        lines.map((line) => ({
          snapshot_id: (snapshot as { id: number }).id,
          ...line,
        })) as never
      )
      if (linesError) throw linesError
    }

    return NextResponse.json({
      ok: true,
      snapshot_id: (snapshot as { id: number }).id,
      report_type: 'profit_and_loss',
      period_start: periodStart,
      period_end: periodEnd,
      basis,
      fetched_at: (snapshot as { fetched_at: string }).fetched_at,
      line_count: lines.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to sync Profit & Loss snapshot' },
      { status: 500 }
    )
  }
}
