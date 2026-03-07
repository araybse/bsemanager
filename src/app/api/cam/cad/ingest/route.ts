import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { camCadIngestSchema } from '@/lib/cam/contracts'
import { applyLatestFieldFreshness, insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = camCadIngestSchema.parse(await request.json())
    const supabase = createAdminClient()

    const upsertRows = payload.objects.map((obj) => ({
      project_id: payload.projectId,
      source_system: payload.sourceSystem,
      drawing_key: payload.drawingKey,
      object_handle: obj.objectHandle,
      object_layer: obj.objectLayer || null,
      object_type: obj.objectType || null,
      geometry_type: obj.geometryType || null,
      geometry: obj.geometry as never,
      attributes: obj.attributes as never,
      updated_at_source: payload.updatedAtSource,
      updated_source_system: payload.sourceSystem,
      updated_by: auth.user.email || auth.user.id,
      sync_state: 'synced',
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase.from('cam_geometry_refs').upsert(upsertRows as never, {
      onConflict: 'project_id,source_system,drawing_key,object_handle',
    })
    if (upsertError) throw upsertError

    await applyLatestFieldFreshness(supabase, {
      projectId: payload.projectId,
      entityTable: 'cam_projects_ext',
      entityPk: String(payload.projectId),
      fieldName: `cad_ingest_${payload.drawingKey}`,
      fieldValue: {
        object_count: payload.objects.length,
        source_system: payload.sourceSystem,
      },
      updatedAtSource: payload.updatedAtSource,
      updatedSourceSystem: payload.sourceSystem,
      updatedBy: auth.user.email || auth.user.id,
    })

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: payload.sourceSystem,
      targetSystem: 'supabase',
      entityTable: 'cam_geometry_refs',
      eventType: 'ingest',
      status: 'success',
      requestPayload: { drawing_key: payload.drawingKey },
      responsePayload: { upserted: payload.objects.length },
    })

    return NextResponse.json({ success: true, upserted: payload.objects.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ingest CAD payload' },
      { status: 500 }
    )
  }
}
