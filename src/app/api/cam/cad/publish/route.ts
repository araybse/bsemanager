import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { cadPublishAckSchema } from '@/lib/cam/contracts'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const projectId = Number(request.nextUrl.searchParams.get('projectId') || 0)
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('cad_publish_queue')
      .select('*')
      .eq('project_id', projectId as never)
      .eq('status', 'pending')
      .order('queued_at', { ascending: true })
      .limit(200)
    if (error) throw error

    return NextResponse.json({ queue: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read CAD publish queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = cadPublishAckSchema.parse(await request.json())
    const supabase = createAdminClient()

    const now = new Date().toISOString()
    const updatePayload =
      payload.status === 'acked'
        ? { status: payload.status, acked_at: now }
        : payload.status === 'applied'
          ? { status: payload.status, applied_at: now }
          : { status: payload.status, error_message: payload.errorMessage || 'Unknown CAD apply error' }

    const { data, error } = await supabase
      .from('cad_publish_queue')
      .update(updatePayload as never)
      .in('id', payload.queueIds as never)
      .select('id, project_id')
    if (error) throw error

    const projectId = (data?.[0] as { project_id: number } | undefined)?.project_id || null
    await insertCamSyncEvent(supabase, {
      projectId,
      sourceSystem: 'cad_plugin',
      targetSystem: 'supabase',
      entityTable: 'cad_publish_queue',
      eventType: 'publish',
      status: payload.status === 'failed' ? 'failed' : 'success',
      requestPayload: { queue_ids: payload.queueIds, status: payload.status },
      responsePayload: { updated_count: data?.length || 0 },
      errorSummary: payload.status === 'failed' ? { message: payload.errorMessage || null } : null,
    })

    return NextResponse.json({ success: true, updated: data?.length || 0 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to acknowledge CAD publish queue' },
      { status: 500 }
    )
  }
}
