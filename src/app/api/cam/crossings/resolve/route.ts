import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { crossingResolveSchema } from '@/lib/cam/contracts'
import { persistCrossingResolution, resolveCrossingGeometry } from '@/lib/cam/crossing-engine'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = crossingResolveSchema.parse(await request.json())
    const outputs = resolveCrossingGeometry(payload)
    const supabase = createAdminClient()

    await persistCrossingResolution(supabase, payload, outputs, payload.editedBy || auth.user.email || auth.user.id)

    const editPayload: {
      crossing_id: number
      project_id: number | null
      edit_payload: never
      reason: string
      created_by: string
    } = {
      crossing_id: payload.crossingId,
      project_id: null,
      edit_payload: payload as never,
      reason: 'manual_conflict_resolution',
      created_by: payload.editedBy || auth.user.email || auth.user.id,
    }
    const { data: crossingRow } = await supabase
      .from('crossings')
      .select('project_id, crossing_code')
      .eq('id', payload.crossingId as never)
      .single()
    const projectId = (crossingRow as { project_id: number } | null)?.project_id || null
    editPayload.project_id = projectId

    await supabase.from('crossing_edits').insert(editPayload as never)

    const queuePayload = {
      project_id: projectId,
      target_system: 'cad_plugin',
      drawing_key: 'WS',
      entity_table: 'crossings',
      entity_pk: String(payload.crossingId),
      action: 'annotate',
      payload: {
        crossing_id: payload.crossingId,
        crossing_code: (crossingRow as { crossing_code: string } | null)?.crossing_code || null,
        result_status: outputs.resultStatus,
        measured_clearance_ft: outputs.measuredClearanceFt,
      } as never,
      status: 'pending',
    }
    await supabase.from('cad_publish_queue').insert(queuePayload as never)

    await insertCamSyncEvent(supabase, {
      projectId,
      sourceSystem: 'crossing_engine',
      targetSystem: 'supabase',
      entityTable: 'crossing_results',
      entityPk: String(payload.crossingId),
      eventType: 'ingest',
      status: outputs.conflictDetected ? 'partial_success' : 'success',
      requestPayload: payload as unknown as Record<string, unknown>,
      responsePayload: outputs as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, outputs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve crossing' },
      { status: 500 }
    )
  }
}
