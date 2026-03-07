import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const projectId = Number(request.nextUrl.searchParams.get('projectId') || 0)
    const supabase = createAdminClient()

    const staleCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const freshnessQuery = supabase
      .from('cam_field_freshness')
      .select('id, sync_state, updated_at_source', { count: 'exact' })
      .neq('sync_state', 'synced')
    const crossingQuery = supabase
      .from('crossings')
      .select('id', { count: 'exact' })
      .eq('status', 'review')
    const queueQuery = supabase
      .from('cad_publish_queue')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')

    if (projectId) {
      freshnessQuery.eq('project_id', projectId as never)
      crossingQuery.eq('project_id', projectId as never)
      queueQuery.eq('project_id', projectId as never)
    }

    const [{ data: staleRows, count: staleCount }, { count: conflictCount }, { count: pendingPublishCount }] =
      await Promise.all([freshnessQuery, crossingQuery, queueQuery])

    const staleByTime = (staleRows || []).filter((row) => {
      const updated = (row as { updated_at_source: string | null }).updated_at_source
      return !!updated && updated < staleCutoff
    }).length

    const state =
      (pendingPublishCount || 0) > 0 || (conflictCount || 0) > 0
        ? 'warning'
        : (staleCount || 0) > 0 || staleByTime > 0
          ? 'warning'
          : 'healthy'

    return NextResponse.json({
      state,
      pendingPublishCount: pendingPublishCount || 0,
      unresolvedConflictCount: conflictCount || 0,
      staleFieldCount: staleCount || 0,
      staleByTimeCount: staleByTime,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute reconciliation summary' },
      { status: 500 }
    )
  }
}
