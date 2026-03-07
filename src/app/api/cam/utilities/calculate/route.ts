import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCamAccess } from '@/lib/cam/auth'
import { utilitiesCalculationSchema } from '@/lib/cam/contracts'
import { persistUtilitiesCalculation, runUtilitiesCalculation } from '@/lib/cam/utilities-engine'
import { insertCamSyncEvent } from '@/lib/cam/sync'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCamAccess()
    if (!auth.ok) return auth.response

    const payload = utilitiesCalculationSchema.parse(await request.json())
    const outputs = runUtilitiesCalculation(payload)
    const supabase = createAdminClient()

    const run = await persistUtilitiesCalculation(
      supabase,
      payload,
      outputs,
      auth.user.email || auth.user.id
    )

    await insertCamSyncEvent(supabase, {
      projectId: payload.projectId,
      sourceSystem: 'utilities_engine',
      targetSystem: 'supabase',
      entityTable: 'utilities_calculations',
      eventType: 'ingest',
      status: outputs.status === 'failed' ? 'failed' : 'success',
      requestPayload: payload as unknown as Record<string, unknown>,
      responsePayload: { run_id: (run as { id: number } | null)?.id || null, outputs },
    })

    return NextResponse.json({ success: true, run, outputs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run utilities calculations' },
      { status: 500 }
    )
  }
}
