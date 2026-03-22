import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

type SnapshotLineRow = {
  section: string | null
  account_name: string
  amount: number | null
  sort_order: number | null
  depth: number | null
  is_total: boolean | null
}

function normalizeParamDate(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function deriveKpis(lines: SnapshotLineRow[]) {
  const byName = new Map<string, number>()
  for (const line of lines) {
    const key = (line.account_name || '').trim().toLowerCase()
    if (!key) continue
    byName.set(key, Number(line.amount) || 0)
  }

  const totalAssets = byName.get('total assets') ?? 0
  const totalLiabilities = byName.get('total liabilities') ?? 0
  const totalEquity = byName.get('total equity') ?? 0

  return {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager'])
    if (!auth.ok) return auth.response

    const qs = request.nextUrl.searchParams
    const periodStart = normalizeParamDate(qs.get('period_start'))
    const periodEnd = normalizeParamDate(qs.get('period_end'))
    const basis = (qs.get('basis') || 'accrual').toLowerCase() === 'cash' ? 'cash' : 'accrual'

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'period_start and period_end query params are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data: snapshot, error: snapshotError } = await supabase
      .from('accounting_snapshots' as never)
      .select('id, report_type, period_start, period_end, basis, fetched_at')
      .eq('report_type' as never, 'balance_sheet')
      .eq('period_start' as never, periodStart as never)
      .eq('period_end' as never, periodEnd as never)
      .eq('basis' as never, basis as never)
      .order('fetched_at' as never, { ascending: false })
      .limit(1)
      .maybeSingle()
    if (snapshotError) throw snapshotError
    if (!snapshot) {
      return NextResponse.json(
        { error: 'No snapshot found for the selected period and basis.' },
        { status: 404 }
      )
    }

    const snapshotId = (snapshot as { id: number }).id
    const { data: linesData, error: linesError } = await supabase
      .from('accounting_snapshot_lines' as never)
      .select('section, account_name, amount, sort_order, depth, is_total')
      .eq('snapshot_id' as never, snapshotId as never)
      .order('sort_order' as never, { ascending: true })
    if (linesError) throw linesError

    const lines = ((linesData || []) as SnapshotLineRow[]).map((line) => ({
      section: line.section || null,
      account_name: line.account_name,
      amount: Number(line.amount) || 0,
      sort_order: Number(line.sort_order) || 0,
      depth: Number(line.depth) || 1,
      is_total: Boolean(line.is_total),
    }))

    return NextResponse.json({
      snapshot,
      kpis: deriveKpis(lines),
      lines,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to load Balance Sheet snapshot' },
      { status: 500 }
    )
  }
}
