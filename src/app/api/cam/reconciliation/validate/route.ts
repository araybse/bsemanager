import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => ({}))) as { projectId?: number }
    const projectId = body.projectId || null
    const supabase = createAdminClient()

    const staleQuery = supabase
      .from('cam_field_freshness')
      .select('id, sync_state', { count: 'exact' })
      .neq('sync_state', 'synced')
    const unresolvedCrossingsQuery = supabase
      .from('crossings')
      .select('id', { count: 'exact' })
      .neq('status', 'resolved')
    const pendingPublishQuery = supabase
      .from('cad_publish_queue')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')

    if (projectId) {
      staleQuery.eq('project_id', projectId as never)
      unresolvedCrossingsQuery.eq('project_id', projectId as never)
      pendingPublishQuery.eq('project_id', projectId as never)
    }

    const [{ count: staleCount }, { count: unresolvedCrossingsCount }, { count: pendingPublishCount }] =
      await Promise.all([staleQuery, unresolvedCrossingsQuery, pendingPublishQuery])

    const summary = {
      staleFieldCount: staleCount || 0,
      unresolvedCrossingsCount: unresolvedCrossingsCount || 0,
      pendingPublishCount: pendingPublishCount || 0,
    }
    const status =
      summary.staleFieldCount > 0 || summary.unresolvedCrossingsCount > 0 || summary.pendingPublishCount > 0
        ? 'warning'
        : 'success'

    await supabase.from('cam_reconciliation_runs').insert({
      project_id: projectId,
      run_type: 'validation',
      status,
      summary: summary as never,
    } as never)

    await insertCamSyncEvent(supabase, {
      projectId,
      sourceSystem: 'cam_validator',
      targetSystem: 'supabase',
      entityTable: 'cam_reconciliation_runs',
      eventType: 'validation',
      status,
      requestPayload: { project_id: projectId || 'all' },
      responsePayload: summary as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, status, summary })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed reconciliation validation run' },
      { status: 500 }
    )
  }
}
