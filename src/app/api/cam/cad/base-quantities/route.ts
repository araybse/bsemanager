import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { insertCamSyncEvent } from '@/lib/cam/sync'

const schema = z.object({
  projectId: z.number().int().positive(),
  sourceSystem: z.string().min(1),
  updatedAtSource: z.string().datetime(),
  drawingKey: z.string().default('BASE'),
  quantities: z.array(
    z.object({
      quantityKey: z.string().min(1),
      quantityValue: z.number(),
      units: z.string().optional(),
      sourceHandle: z.string().optional(),
    })
  ),
  parcelLinks: z
    .array(
      z.object({
        parcelRef: z.string().min(1),
        parcelAreaSqft: z.number().min(0),
        structureRef: z.string().min(1),
      })
    )
    .default([]),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = schema.parse(await request.json())
    const supabase = createAdminClient()

    const quantityRows = payload.quantities.map((quantity) => ({
      project_id: payload.projectId,
      drawing_key: payload.drawingKey,
      quantity_key: quantity.quantityKey,
      quantity_value: quantity.quantityValue,
      units: quantity.units || null,
      source_handle: quantity.sourceHandle || null,
      updated_at_source: payload.updatedAtSource,
      updated_source_system: payload.sourceSystem,
      updated_by: auth.user.email || auth.user.id,
      sync_state: 'synced',
      updated_at: new Date().toISOString(),
    }))

    if (quantityRows.length > 0) {
      const { error: quantityError } = await supabase.from('cad_base_quantities').upsert(
        quantityRows as never,
        { onConflict: 'project_id,drawing_key,quantity_key,source_handle' }
      )
      if (quantityError) throw quantityError
    }

    const parcelRows = payload.parcelLinks.map((link) => ({
      project_id: payload.projectId,
      parcel_ref: link.parcelRef,
      parcel_area_sqft: link.parcelAreaSqft,
      structure_ref: link.structureRef,
      is_dynamic: true,
      updated_at_source: payload.updatedAtSource,
      updated_source_system: payload.sourceSystem,
      updated_by: auth.user.email || auth.user.id,
      sync_state: 'synced',
      updated_at: new Date().toISOString(),
    }))

    if (parcelRows.length > 0) {
      const { error: parcelError } = await supabase.from('cad_parcel_structure_links').upsert(
        parcelRows as never,
        { onConflict: 'project_id,parcel_ref' }
      )
      if (parcelError) throw parcelError
    }

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: payload.sourceSystem,
      targetSystem: 'supabase',
      entityTable: 'cad_base_quantities',
      eventType: 'ingest',
      status: 'success',
      requestPayload: { drawing_key: payload.drawingKey },
      responsePayload: { quantity_count: quantityRows.length, parcel_link_count: parcelRows.length },
    })

    return NextResponse.json({
      success: true,
      quantityCount: quantityRows.length,
      parcelLinkCount: parcelRows.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ingest base quantities payload' },
      { status: 500 }
    )
  }
}
