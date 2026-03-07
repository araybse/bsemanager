import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

type HealthState = 'healthy' | 'warning' | 'critical'

export async function GET() {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager', 'employee', 'client'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const now = Date.now()

    const [syncLatestResp, syncFailedResp, dqLatestResp, unmatchedResp] = await Promise.all([
      supabase
        .from('sync_runs')
        .select('finished_at')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sync_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase
        .from('data_quality_runs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('project_expenses')
        .select('*', { count: 'exact', head: true })
        .or('project_id.is.null,project_number.is.null,project_number.eq.'),
    ])

    if (syncLatestResp.error) throw syncLatestResp.error
    if (syncFailedResp.error) throw syncFailedResp.error
    if (dqLatestResp.error) throw dqLatestResp.error
    if (unmatchedResp.error) throw unmatchedResp.error

    const latestSyncAt = (syncLatestResp.data as { finished_at: string | null } | null)?.finished_at || null
    const latestDqAt = (dqLatestResp.data as { created_at: string | null } | null)?.created_at || null
    const failedSyncCount = syncFailedResp.count || 0
    const unmatchedExpenseCount = unmatchedResp.count || 0

    const syncAgeHours = latestSyncAt
      ? (now - new Date(latestSyncAt).getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY
    const dqAgeHours = latestDqAt
      ? (now - new Date(latestDqAt).getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY

    let state: HealthState = 'healthy'
    if (failedSyncCount > 0 || syncAgeHours > 72 || dqAgeHours > 72) {
      state = 'critical'
    } else if (unmatchedExpenseCount > 0 || syncAgeHours > 24 || dqAgeHours > 24) {
      state = 'warning'
    }

    return NextResponse.json({
      state,
      latestSyncAt,
      latestDataQualityRunAt: latestDqAt,
      failedSyncCount,
      unmatchedExpenseCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load operations health' },
      { status: 500 }
    )
  }
}
