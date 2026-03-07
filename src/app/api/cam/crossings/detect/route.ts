import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { crossingDetectionSchema } from '@/lib/cam/contracts'
import { applyLatestFieldFreshness, insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = crossingDetectionSchema.parse(await request.json())
    const supabase = createAdminClient()

    const rows = payload.crossings.map((item) => ({
      project_id: payload.projectId,
      crossing_code: item.crossingCode,
      source_network_a: item.sourceNetworkA,
      source_network_b: item.sourceNetworkB,
      source_ref_a: item.sourceRefA,
      source_ref_b: item.sourceRefB,
      x_coord: item.xCoord,
      y_coord: item.yCoord,
      status: 'detected',
      updated_at_source: payload.updatedAtSource,
      updated_source_system: payload.sourceSystem,
      updated_by: auth.user.email || auth.user.id,
      sync_state: 'synced',
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('crossings').upsert(rows as never, {
      onConflict: 'project_id,crossing_code',
    })
    if (error) throw error

    await applyLatestFieldFreshness(supabase, {
      projectId: payload.projectId,
      entityTable: 'crossings',
      entityPk: String(payload.projectId),
      fieldName: 'crossing_detection_count',
      fieldValue: payload.crossings.length,
      updatedAtSource: payload.updatedAtSource,
      updatedSourceSystem: payload.sourceSystem,
      updatedBy: auth.user.email || auth.user.id,
    })

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: payload.sourceSystem,
      targetSystem: 'supabase',
      entityTable: 'crossings',
      eventType: 'ingest',
      status: 'success',
      requestPayload: { count: payload.crossings.length },
      responsePayload: { upserted: payload.crossings.length },
    })

    return NextResponse.json({ success: true, upserted: payload.crossings.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect crossings' },
      { status: 500 }
    )
  }
}
